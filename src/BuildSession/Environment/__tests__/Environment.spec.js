const Environment = require('../');

test('Environment is an EventEmitter');

test('Environment has static Mode dictionary of constants', () => {
    expect(Environment.Mode).toMatchObject({
        DEVELOPMENT: 'development',
        PRODUCTION: 'production'
    });
});

test('Environment has a factory for creating Environments', () => {
    const env = Environment.create('development');
    expect(env).toBeInstanceOf(Environment);
});

test('Environment constructor validates mode', () => {
    expect(() => Environment.create('wuh')).toThrow('Unknown mode');
});
