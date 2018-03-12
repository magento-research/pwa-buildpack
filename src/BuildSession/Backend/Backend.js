const debug = require('../../util/debug').here(__filename);
const Provisioner = require('./BackendProvisioner');
const OSXLocalHosted = require('./Presets/OSXLocalHosted');
const VagrantVMHosted = require('./Presets/VagrantVMHosted');
const { Mode } = require('../Environment');
class Backend {
    static get presets() {
        return {
            OSXLocalHosted,
            VagrantVMHosted
        };
    }
    static develop(preset, env, config) {
        const PresetDevProvisioner = preset[Mode.DEVELOPMENT] || preset;
        debug(`develop(${PresetDevProvisioner.name})`);
        return Provisioner.run(PresetDevProvisioner, env, config);
    }
    static provide(preset, env, config) {
        const PresetProdProvisioner = preset[Mode.PRODUCTION] || preset;
        debug(`provide(${PresetProdProvisioner.name})`);
        return Provisioner.run(PresetProdProvisioner, env, config);
    }
}

module.exports = Backend;
