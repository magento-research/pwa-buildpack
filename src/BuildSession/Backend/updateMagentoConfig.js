const debug = require('../../util/debug').here(__filename);

module.exports = async ({ baseDir, hostOS, requiredConfig }) => {
    const runCommand = command =>
        hostOS.exec(command).catch(e => {
            throw Error(
                debug.errorMsg(
                    `Failed to configure Magento installation at ${baseDir}. Error running '${command}': ${e.stderr ||
                        e.stdout}`
                )
            );
        });

    const shownConfig = await runCommand('bin/magento config:show');
    const currentConfig = shownConfig
        .trim()
        .split('\n')
        .reduce((out, line) => {
            const [address, value] = line.trim().split(' - ');
            out[address] = value;
            return out;
        }, {});
    debug('currentConfig: ', currentConfig);

    const ensuringInstalled = runCommand('bin/magento setup:upgrade');

    const ensuringConfigured = Object.entries(requiredConfig).reduce(
        (job, [address, value]) => {
            if (currentConfig[address] === value.toString()) {
                return job;
            } else {
                return job.then(() =>
                    runCommand(`bin/magento config:set ${address} ${value}`)
                );
            }
        },
        ensuringInstalled
    );

    await ensuringConfigured;

    // TODO: (debt) this is obviously a fixture; we are refactoring the prepare
    // command to be a more secure Web API call
    return {
        publicPath: process.env.MAGENTO_BACKEND_PUBLIC_PATH
    };
    // try {
    //     return await hostOS.exec('bin/magento dev:pwa:prepare');
    // } catch (e) {
    //     if (
    //         e.message &&
    //         e.message.indexOf('bin/magento: No such file or directory') !== -1
    //     ) {
    //         throw Error(
    //             debug.errorMsg(
    //                 `The configured base directory, ${baseDir}, does not have access to bin/magento. This usually means it doesn't contain Magento and it may not be the right directory.`
    //             )
    //         );
    //     }
    //     if (
    //         e.message &&
    //         e.message.indexOf(
    //             'no commands defined in the "dev:pwa" namespace'
    //         ) !== -1
    //     ) {
    //         throw Error(
    //             debug.errorMsg(
    //                 `The Magento_Pwa module is incorrectly loaded or configured. The "dev:pwa:prepare" command must be available in order to proceed.`
    //             )
    //         );
    //     }
    //     throw e;
    // }
};
