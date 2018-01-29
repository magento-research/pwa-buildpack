jest.mock('fs');
jest.mock('child_process');
const fs = require('fs');
const { execSync } = require('child_process');
const tmp = require('tmp');
const TempFile = require('../../temp-file');
const OpenSSLCLI = require('../openssl-cli');
describe('OSX-only OpenSSLCLI', () => {
    beforeEach(() => jest.clearAllMocks());
    describe('static .createPassphrase', () => {
        it('returns openssl-compatible file:<tmp> password arguments', () => {
            const phrasefile = OpenSSLCLI.createPassphrase();
            expect(phrasefile).toMatch(/^file:.+/);
        });
        it('creates a temp file containing the passphrase', () => {
            const phrasefile = OpenSSLCLI.createPassphrase();
            const filename = phrasefile.replace(/^file:/, '');
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                filename,
                expect.stringMatching(/P[0-9A-F]+/i),
                'utf8'
            );
        });
    });
    describe('instance', () => {
        const expectedMethods = ['run', 'createP12', 'createImportablePEM'];
        let cli;
        beforeEach(() => {
            cli = new OpenSSLCLI();
        });
        it(`has ${expectedMethods.join(', ')} methods`, () => {
            expectedMethods.forEach(method => {
                expect(cli[method]).toBeInstanceOf(Function);
            });
        });
        it('.createP12() method calls openssl to make a .p12 file', () => {
            const fakeKeyFile = { path: 'keyfilepath' };
            const fakePemfile = { path: 'pemfilepath' };
            const p12file = cli.createP12(
                fakeKeyFile,
                fakePemfile,
                'fakepassphrase'
            );
            const p12tmp = tmp.__mock.lastTmpName;
            expect(execSync).toHaveBeenCalledWith(
                `openssl pkcs12 -export -inkey keyfilepath -in pemfilepath -certfile pemfilepath -out ${
                    p12tmp
                } -passout fakepassphrase`,
                { encoding: 'utf8' }
            );
            expect(p12file).toBeInstanceOf(TempFile);
            expect(p12file).toHaveProperty('path', p12tmp);
        });
        it('.createImportablePEM() method calls openssl to make a .pem file from a .p12 file', () => {
            const p12file = { path: 'p12filepath' };
            const pem = cli.createImportablePEM(p12file, 'fakein', 'fakeout');
            const pemtmp = tmp.__mock.lastTmpName;
            expect(execSync).toHaveBeenCalledWith(
                `openssl pkcs12 -in p12filepath -out ${
                    pemtmp
                } -passin fakein -passout fakeout`,
                { encoding: 'utf8' }
            );
            expect(pem).toBeInstanceOf(TempFile);
            expect(pem).toHaveProperty('path', pemtmp);
        });
    });
});
