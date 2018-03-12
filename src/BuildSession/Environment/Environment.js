const EventEmitter = require('events');
const debug = require('../../util/debug').here(__filename);
const Mode = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production'
};
const validModes = Object.keys(Mode).map(k => Mode[k]);
class Environment extends EventEmitter {
    static Mode = Mode;
    static create(mode) {
        return new Environment(mode);
    }
    constructor(provided) {
        super();
        debug.sub('construct')(provided);
        if (!validModes.some(m => m === provided)) {
            throw Error(
                debug.errorMsg(
                    `Unknown mode '${provided}'. Valid modes are "development" and "production".`
                )
            );
        }
        this.mode = provided;
    }
}
module.exports = Environment;
