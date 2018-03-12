const DevMode = require('../DevMode');

const keyRE = /^[a-z_]+\/[a-z_]+\/[a-z_]+$/;
test('getRequiredConfigValues() returns a hash of required M2 config values', () => {
    const prov = new DevMode();
    prov.config = {
        backendDomain: 'A BACKEND DOMAIN'
    };
    const required = prov.getRequiredConfigValues();
    expect(required).toBeInstanceOf(Object);
    const invalidKeys = Object.keys(required).filter(key => !keyRE.test(key));
    expect(invalidKeys).toEqual([]);
    expect(required['web/secure/base_url']).toBe('A BACKEND DOMAIN/');
});

test('getRequiredConfigValues() ensures URL formatting', () => {
    const prov = new DevMode();
    prov.config = {
        backendDomain: 'A BACKEND DOMAIN/'
    };
    const required = prov.getRequiredConfigValues();
    expect(required).toBeInstanceOf(Object);
    const invalidKeys = Object.keys(required).filter(key => !keyRE.test(key));
    expect(invalidKeys).toEqual([]);
    expect(required['web/secure/base_url']).toBe('A BACKEND DOMAIN/');
});
