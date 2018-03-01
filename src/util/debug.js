const path = require('path');
const debug = require('debug');
const root = path.resolve(__dirname, '../');
const pkg = require(path.resolve(root, '../package.json'));
const toolName = pkg.name.split('/').pop();
const tokenize = (...parts) => parts.join(':');

const taggedLogger = tag => {
    const logger = debug(tag);
    logger.errorMsg = msg => `[${tag}] ${msg}`;
    logger.sub = sub => taggedLogger(tokenize(tag, sub));
    return logger;
};
module.exports = {
    here(p) {
        const segments = path.relative(root, p).split(path.sep);
        if (segments[segments.length - 1] === 'index.js') {
            segments.pop();
        }
        const tag = tokenize(toolName, ...segments);
        return taggedLogger(tag);
    }
};
