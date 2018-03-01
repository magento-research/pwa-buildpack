const Resolver = require('../Resolver');
test('static configure() produces a webpack resolver config', () => {
    expect(
        Resolver.configure({
            paths: {
                root: 'fakeRoot',
                modules: 'fakeModules'
            }
        })
    ).toEqual({
        modules: ['fakeRoot', 'fakeModules'],
        mainFiles: ['index'],
        extensions: ['.js']
    });
});
