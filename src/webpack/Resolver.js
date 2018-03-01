class Resolver {
    static configure({ paths }) {
        return {
            modules: [paths.root, paths.modules],
            mainFiles: ['index'],
            extensions: ['.js']
        };
    }
}
module.exports = Resolver;
