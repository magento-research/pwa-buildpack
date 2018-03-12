const debug = require('../../util/debug').here(__filename);
const HasLifecycle = require('../HasLifecycle');
const HostOSAdapter = require('./HostOSAdapter');

class BackendProvisioner {
    async nowConfigure(config) {
        return config;
    }
    async nowConnect() {}
    async nowPrepare() {}
}

module.exports = HasLifecycle(BackendProvisioner, {
    name: 'BackendProvisioner',
    lifecycle: [
        {
            name: 'connect',
            async run(self, cb) {
                self.hostOS = await cb();
                if (!(self.hostOS instanceof HostOSAdapter)) {
                    throw Error(
                        debug.errorMsg(
                            `connect phase must produce a HostOSAdapter interface!`
                        )
                    );
                }
            }
        },
        {
            name: 'prepare',
            async run(self, cb) {
                await cb();
            }
        }
    ]
});
