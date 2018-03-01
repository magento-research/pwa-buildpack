const optionsValidator = require('../util/options-validator');
class MagentoResolver {
    static validateConfig = optionsValidator('MagentoResolver', {
        'paths.root': 'string'
    });
    static async configure(options) {
        this.validateConfig('.configure()', options);
        return {
            modules: [options.paths.root, 'node_modules'],
            mainFiles: ['index'],
            extensions: ['.js']
        };
    }
}
module.exports = MagentoResolver;
