const debug = require('../util/debug').here(__filename);
class BuildSession {
    static Backend = require('./Backend');
    static Frontend = require('./Frontend');
    static Environment = require('./Environment');
    static SUPPORTED_MODES = [];
    static SUPPORTED_FRONTEND_PROVISIONERS = [];
    static SUPPORTED_BACKEND_PROVISIONERS = [];

    static matches({ env, frontend, backend }) {
        debug(`${this.name}.matches()`, env, frontend, backend);
        return (
            this.SUPPORTED_MODES.some(mode => mode === env.mode) &&
            this.SUPPORTED_FRONTEND_PROVISIONERS.some(
                cls => frontend instanceof cls
            ) &&
            this.SUPPORTED_BACKEND_PROVISIONERS.some(
                cls => backend instanceof cls
            )
        );
    }

    static async start({ env, frontend, backend }) {
        // lazy load this property so that the circular dependency resolves
        this.Scenarios = this.Scenarios || {
            LocalWebpackDev: require('./Scenarios/LocalWebpackDev'),
            LocalWebpackProduction: require('./Scenarios/LocalWebpackProduction')
        };
        this._scenarioKeys = Object.keys(this.Scenarios);
        const compatible = this._scenarioKeys.filter(k =>
            this.Scenarios[k].matches({ env, frontend, backend })
        );
        if (compatible.length === 0) {
            throw Error(
                debug.errorMsg(
                    `No compatible build session scenarios found for env/frontend/backend combination.`
                )
            );
        } else if (compatible.length > 1) {
            throw Error(
                debug.errorMsg(
                    `Found more than one compatible build session scenario for env/frontend/backend combination.`,
                    compatible
                )
            );
        } else {
            const Session = this.Scenarios[compatible[0]];
            const session = new Session({ env, frontend, backend });
            await session.connect();
            return session;
        }
    }

    constructor({ env }) {
        this.env = env;
    }

    /* istanbul ignore next: base method */
    async connect() {}

    envToVars() {
        return {
            NODE_ENV: this.env.mode
        };
    }
}
module.exports = BuildSession;
