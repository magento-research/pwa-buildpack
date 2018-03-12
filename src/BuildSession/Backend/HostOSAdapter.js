const debug = require('../../util/debug').here(__filename);
const path = require('path');
const local = require('../../util/promisified');
class HostOSAdapter {
    constructor({ cwd, exec, readFile, writeFile, stat } = {}) {
        this.cwd = cwd;
        this.defaultOptions = {
            cwd,
            encoding: 'utf8'
        };
        this._exec = exec || local.child_process.exec;
        this._readFile = readFile || local.fs.readFile;
        this._writeFile = writeFile || local.fs.writeFile;
        this._stat = stat || local.fs.stat;
    }
    _mergeDefaults(opts) {
        return Object.assign({}, this.defaultOptions, opts);
    }
    async connect() {
        // confirm baseDir is there
        try {
            debug(`confirm directory exists`);
            await this.exec(`[ -d "${this.cwd}" ]`);
        } catch (e) {
            throw Error(
                debug.errorMsg(
                    `hostOS did not report that "${this.cwd}" is a directory.`,
                    e
                )
            );
        }
    }
    async exec(cmd, opts) {
        debug(`exec => ${cmd}`);
        return this._exec(cmd, this._mergeDefaults(opts)).then(
            out => {
                debug(`exec returned: `, out.stdout);
                return out.stdout;
            },
            e => {
                debug(`exec failed: `, e);
                throw e;
            }
        );
    }
    async readFile(filepath, opts) {
        return this._readFile(filepath, this._mergeDefaults(opts));
    }
    async stat(filepath) {
        return this._stat(filepath);
    }
    async writeFile(filepath, contents, opts) {
        const dir = path.dirname(filepath);
        try {
            debug(`writeFile('${filepath}'): checking that ${dir} exists...`);
            await this._stat(dir);
        } catch (e) {
            if (e.code === 'ENOENT') {
                debug(`${dir} does not exist, making`);
                await this.exec(`mkdir -p ${dir}`);
            } else {
                throw e;
            }
        }
        return this._writeFile(filepath, contents, this._mergeDefaults(opts));
    }
}
module.exports = HostOSAdapter;
