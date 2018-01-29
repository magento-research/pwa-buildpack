jest.mock('fs');
const fs = require('fs');
const eol = require('eol');
const WebpackPEM = require('../webpack-pem');
const { URL } = require('url');
const forge = require('node-forge');
const PHOO = `
------BEGIN TEST PHOO------
haluhglauhguhalgh
------END TEST PHOO------
`.trim();
const BAHR = `
---BEGIN TEST BAHR---
nhgnfhgbhmgb
---END TEST BAHR---
`.trim();
const PHOO_BAHR = `
${PHOO}
${BAHR}
`.trim();
describe('Webpack PEM', () => {
    let goodPem;
    beforeAll(() => {
        goodPem = WebpackPEM.generate();
    });
    beforeEach(() => {
        jest.clearAllMocks();
        fs.__reset();
    });
    describe('static method BlockParser takes a key-to-label object', () => {
        it('throws if the object has non-string values', () => {
            expect(() => WebpackPEM.BlockParser({ k: 2 })).toThrow(
                'keyToLabel argument must be an object with all-string values'
            );
        });
        describe('returns a function', () => {
            let parse;
            beforeEach(() => {
                parse = WebpackPEM.BlockParser({
                    foo: 'test phoo',
                    bar: 'test bahr'
                });
            });
            it('parses a string into labeled substrings based on delimited blocks', () => {
                const { foo, bar } = parse(PHOO_BAHR);
                expect(foo).toBe(PHOO);
                expect(bar).toBe(BAHR);
            });
            it('silently fails when the text does not match', () => {
                let parsed;
                expect(() => {
                    parsed = parse('blorf');
                }).not.toThrow();
                expect(parsed).toBeInstanceOf(Object);
                expect(parsed.foo).toBeFalsy();
                expect(parsed.bar).toBeFalsy();
            });
        });
    });
    describe('static method .generate()', () => {
        it('creates a webpack-valid key-cert pair', () => {
            expect(() =>
                forge.pki.certificateFromPem(goodPem.cert)
            ).not.toThrow();
            expect(() =>
                forge.pki.privateKeyFromPem(goodPem.key)
            ).not.toThrow();
            expect(() => new WebpackPEM().write(goodPem)).not.toThrow();
        });
        it('takes an optional argument for a different URL', () => {
            const pem = WebpackPEM.generate(
                new URL('https://fake.domain:8081')
            );
            const cert = forge.pki.certificateFromPem(pem.cert);
            expect(cert.subject.attributes).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'commonName',
                        value: 'fake.domain'
                    })
                ])
            );
            expect(() => new WebpackPEM().write(pem)).not.toThrow();
        });
    });
    describe('instance', () => {
        let key, cert;
        beforeAll(() => {
            key = eol.auto(goodPem.key).trim();
            cert = eol.auto(goodPem.cert).trim();
        });
        describe('#read method', () => {
            it('reads from the default path', () => {
                fs.__mockWriteFileSync(WebpackPEM.DEFAULT_PATH, '');
                new WebpackPEM().read();
                expect(fs.readFileSync).toHaveBeenCalledWith(
                    WebpackPEM.DEFAULT_PATH,
                    'utf8'
                );
            });
            it('reads from a custom path', () => {
                fs.__mockWriteFileSync('customPath', '');
                new WebpackPEM('customPath').read();
                expect(fs.readFileSync).toHaveBeenCalledWith(
                    'customPath',
                    'utf8'
                );
            });
            describe('fails silently to exist if', () => {
                it('the path does not exist', () => {
                    const pem = new WebpackPEM();
                    pem.read();
                    expect(pem.exists).toBe(false);
                });
                it('the key and cert are not both valid', () => {
                    const pem = new WebpackPEM();
                    fs.__mockWriteFileSync(WebpackPEM.DEFAULT_PATH, key);
                    pem.read();
                    expect(pem).toMatchObject({
                        key,
                        contents: key,
                        exists: false
                    });
                    fs.__mockWriteFileSync(WebpackPEM.DEFAULT_PATH, cert);
                    pem.read();
                    expect(pem).toMatchObject({
                        cert,
                        contents: cert,
                        exists: false
                    });
                });
            });
            it('exists successfully if key and cert are valid', () => {
                fs.__mockWriteFileSync(
                    WebpackPEM.DEFAULT_PATH,
                    key + '\n' + cert
                );
                const pem = new WebpackPEM();
                pem.read();
                expect(pem).toMatchObject({
                    key,
                    cert,
                    exists: true
                });
            });
        });
        describe('#write method', () => {
            it('throws if it receives a bad key or cert', () => {
                const pem = new WebpackPEM();
                expect(() => pem.write()).toThrow('Unrecognized input');
                expect(() => pem.write({ key })).toThrow('Unrecognized input');
                expect(() => pem.write({ cert })).toThrow('Unrecognized input');
            });
            describe('receives a valid key and cert and', () => {
                let pem;
                beforeEach(() => {
                    pem = new WebpackPEM();
                    pem.write({ key, cert });
                });
                it('writes to fs', () => {
                    expect(fs.writeFileSync).toHaveBeenCalledWith(
                        pem.path,
                        eol.crlf(key + '\n' + cert),
                        'utf8'
                    );
                });
                it('sets contents, key, and cert properties', () => {
                    expect(pem).toMatchObject({
                        contents: key + '\n' + cert,
                        key,
                        cert,
                        exists: true
                    });
                });
            });
        });
    });
});
