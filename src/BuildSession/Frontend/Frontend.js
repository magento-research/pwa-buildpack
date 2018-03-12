const debug = require('../../util/debug').here(__filename);
const Provisioner = require('./FrontendProvisioner');
const PeregrineApp = require('./Presets/PeregrineApp');
const { Mode } = require('../Environment');
class Frontend {
    static get presets() {
        return {
            PeregrineApp
        };
    }
    static develop(preset, env, config) {
        const PresetDevProvisioner = preset[Mode.DEVELOPMENT] || preset;
        debug(`develop(${PresetDevProvisioner.name})`);
        return Provisioner.run(PresetDevProvisioner, env, config);
    }
    static compile(preset, env, config) {
        const PresetProdProvisioner = preset[Mode.PRODUCTION] || preset;
        debug(`compile(${PresetProdProvisioner.name})`);
        return Provisioner.run(PresetProdProvisioner, env, config);
    }
}

module.exports = Frontend;
