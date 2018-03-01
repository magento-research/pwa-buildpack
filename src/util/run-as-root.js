const debug = require('./debug').here(__filename);
const path = require('path');
const { writeFile } = require('./promisified/fs');
const sudoPrompt = require('sudo-prompt');
const { join } = require('path');
const tmp = () =>
    join(
        __dirname,
        'tmp' +
            Math.random()
                .toString(20)
                .slice(2)
    );

const opts = {
    name: 'Magento PWA Studio',
    icns: path.join(__dirname, '../../buildpack-logo.icns')
};

const elevate = async cmd =>
    new Promise((enjoy, regret) => {
        debug(`running sudoPrompt("${cmd}") now...`);
        sudoPrompt.exec(cmd, opts, (error, stdout, stderr) => {
            debug(`sudo ${cmd} returned`, { error, stdout, stderr });
            if (error) {
                error.message = [error.message, stderr, stdout]
                    .filter(x => !!x)
                    .join('\n\n');
                return regret(error);
            }
            return enjoy(stdout);
        });
    });

module.exports = async (fn, ...args) => {
    const impl = fn.toString();
    const scriptLoc = tmp();
    const invoked = `(${impl})(...${JSON.stringify(args)})`;
    await writeFile(scriptLoc, invoked, 'utf8');
    debug(`elevating privileges for ${impl}`);
    return elevate(`${process.argv[0]} ${scriptLoc} && rm ${scriptLoc}`);
};
