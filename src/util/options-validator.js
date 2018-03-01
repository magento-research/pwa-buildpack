const lget = require('lodash.get');
const NOPE = {};

class BuildpackValidationError extends Error {
    constructor(name, callsite, validationErrors) {
        super();

        const bullet = '\n\t- ';
        this.name = 'BuildpackValidationError';
        this.message =
            `${name}: Invalid configuration object. ` +
            `${callsite} was called with a configuration object that has the following problems:${bullet}` +
            validationErrors
                .map(
                    ([key, requiredType]) =>
                        `${key} must be of type ${requiredType}`
                )
                .join(bullet);
        this.validationErrors = validationErrors;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = (name, simpleSchema) => (callsite, options) => {
    const invalid = Object.entries(simpleSchema).reduce(
        (out, [key, requiredType]) => {
            const opt = lget(options, key, NOPE);
            if (opt === NOPE || typeof opt !== requiredType) {
                out.push([key, requiredType]);
            }
            return out;
        },
        []
    );
    if (invalid.length > 0) {
        throw new BuildpackValidationError(name, callsite, invalid);
    }
};
