// TODO: (p2) make test file, test scenario
const { Mode } = require('../Environment');
const Frontend = require('../Frontend');
const Backend = require('../Backend');
const BuildSession = require('../BuildSession');
class LocalWebpackProduction extends BuildSession {
    static SUPPORTED_MODES = [Mode.PRODUCTION];
    static SUPPORTED_FRONTEND_PROVISIONERS = [
        Frontend.presets.PeregrineApp[Mode.PRODUCTION]
    ];
    static SUPPORTED_BACKEND_PROVISIONERS = [
        Backend.presets.OSXLocalHosted[Mode.PRODUCTION],
        Backend.presets.VagrantVMHosted[Mode.PRODUCTION]
    ];
    constructor({ env, frontend }) {
        this.env = env;
        this.dirs = frontend.dirs;
        this.files = frontend.files;
        this.includes = frontend.includes;
    }
}
module.exports = LocalWebpackProduction;
