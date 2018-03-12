const path = require('path');
const debug = require('../../../util/debug').here(__filename);
const HostOSAdapter = require('../HostOSAdapter');
const {
    fs: localFs,
    child_process: { exec: localExec }
} = require('../../../util/promisified');

class VagrantCLI {
    /**
     * Naive, stringy way to parse vagrant global-status.
     * No need to make this more formal while Vagrant still makes no
     * guarantees about its format.
     * Machine-readable shell output is not on the roadmap:
     * https://github.com/hashicorp/vagrant/issues/8017
     * @return Promise<Object[]>;
     */
    async run(cmd, opts) {
        return (await localExec(`vagrant ${cmd}`, opts)).stdout;
    }
    async globalStatus() {
        const output = await this.run('global-status');
        debug(`global-status: `, output);
        const lines = output.trim().split('\n');

        // this seems safe enough
        const headerLine = lines[0];

        const delimRE = /\s+/;
        // without space chars, there's no way to parse this safely i think!
        if (!delimRE.test(headerLine)) {
            throw Error(debug.errorMsg(`Unrecognized input: ${output}`));
        }

        const fields = headerLine.trim().split(delimRE);

        // limit to lines that are part of the table, assuming a header and
        // horizontal line above it and a blank line after
        const machineRows = lines.slice(
            2,
            // locate first blank (falsy) line
            lines.findIndex(l => !l.trim())
        );

        // make the return array by folding over non-header rows looking
        // for parseable machine rows
        return machineRows.reduce((machines, line) => {
            // assume that it is a machine row when the line has the same number of columns.
            const values = line.trim().split(delimRE);
            // so if it doesn't have the same number, die
            if (values.length !== fields.length) {
                throw Error(
                    debug.errorMsg(`Expected "${values}" to match "${fields}"`)
                );
            }
            // fold over the field names, zipping them into an object
            // with values
            const machine = fields.reduce((out, field, index) => {
                out[field] = values[index];
                return out;
            }, {});
            return machines.concat(machine);
        }, []);
    }
    /**
     * Vagrant does not enforce unique names, so a name may refer to more than
     * one machine.
     * @param {string} name
     */
    async nameToMachines(name) {
        const machines = await this.globalStatus();
        return machines.filter(machine => machine.name === name);
    }
}

module.exports = class VagrantVMAdapter extends HostOSAdapter {
    constructor(conf) {
        super(
            Object.assign({}, conf, {
                exec: (...args) => this.vm.shellExec(...args),
                readFile: (...args) => this.vm.readFile(...args),
                writeFile: (...args) => this.vm.writeFile(...args),
                stat: p => this.vm.stat(p)
            })
        );
        this.vm = {
            name: conf.vmName
        };
    }
    async connect() {
        const vagrant = new VagrantCLI();
        const vm = this.vm;
        const machines = await vagrant.nameToMachines(vm.name);
        const machine = machines[0];
        if (!machine) {
            throw Error(`Vagrant could not find a machine named '${vm.name}'`);
        }
        debug(`found vagrant machine for ${vm.name}:`, machine);
        if (machines.length > 1) {
            throw Error(
                debug.errorMsg(
                    `Warning: Found ${machines.length} machines named ${
                        vm.name
                    }`
                )
            );
        }
        vm.machine = machine;
        vm.shellExec = cmd => {
            const escaped = cmd.split("'").join("'\"'\"'");
            return vagrant.run(
                `ssh -c 'cd $MAGENTO_ROOT && ${escaped}' -- -T`,
                {
                    cwd: machine.directory
                }
            );
        };
        vm.readFile = p => {
            return vm.shellExec(`sudo cat ${p}`);
        };
        vm.writeFile = async (p, contents) => {
            const name =
                'T' +
                Math.random()
                    .toString(36)
                    .slice(2);
            const tmppath = path.join(machine.directory, 'etc', name);
            debug(`temp writing to ${tmppath}`);
            await localFs.writeFile(tmppath, contents, 'utf8');
            await vm.shellExec(`sudo mkdir -p ${path.dirname(p)}`);
            await vm.shellExec(`sudo cp /vagrant/etc/${name} ${p}`);
            await localFs.unlink(tmppath);
        };
        vm.stat = async p => {
            try {
                await vm.shellExec(`sudo stat ${p}`);
            } catch (e) {
                if (
                    e.message.indexOf('No such') !== -1 ||
                    e.stderr.indexOf('No such') !== -1
                ) {
                    e.code = 'ENOENT';
                    throw e;
                }
            }
        };
        this.cwd = (await vm.shellExec('echo $MAGENTO_ROOT')).trim();
        return await super.connect();
    }
};
