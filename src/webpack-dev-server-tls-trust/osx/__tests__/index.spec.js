let deathHandler;
const mockeryOfDeath = jest.fn(fn => {
    deathHandler = fn;
});
jest.doMock('death', () => arg => {
    if (typeof arg === 'function') {
        return mockeryOfDeath(arg);
    }
    return mockeryOfDeath;
});
const TempFileMock = jest.fn();
jest.doMock(
    '../../../temp-file',
    () =>
        function() {
            return TempFileMock();
        }
);
jest.doMock('../../webpack-pem');
jest.doMock('../../openssl-cli');
jest.doMock('../security-cli');
const WebpackPEM = require('../../webpack-pem');
const TempFile = require('../../../temp-file');
const OpenSSLCLI = require('../../openssl-cli');
const SecurityCLI = require('../security-cli');
const ON_DEATH = require('death');
const logger = {
    warn: jest.fn(),
    info: jest.fn()
};
const proc = {
    exit: jest.fn(),
    on: jest.fn()
};
const trust = require('../')(logger, proc);

const getPemInstance = () =>
    WebpackPEM.mock.instances[WebpackPEM.mock.instances.length - 1];

describe('OSX SSL trust script', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('tries to generate a new PEM', () => {
        WebpackPEM.generate.mockImplementationOnce(() => 'fakePem');
        trust();
        expect(WebpackPEM.generate).toHaveBeenCalledTimes(1);
        expect(WebpackPEM.prototype.write).toHaveBeenCalledWith('fakePem');
    });
    it('tries to put back an existing one if it fails', () => {
        WebpackPEM.prototype.read.mockImplementationOnce(() => {
            const self = getPemInstance();
            self.exists = true;
            self.key = 'oldKey';
            self.cert = 'oldCert';
        });
        WebpackPEM.prototype.write
            .mockImplementationOnce(() => {
                getPemInstance().exists = false;
            })
            .mockImplementationOnce(() => {
                throw Error('wtf');
            });
        trust();
        expect(WebpackPEM.prototype.write).toHaveBeenCalledWith(
            expect.objectContaining({
                key: 'oldKey',
                cert: 'oldCert'
            })
        );
        expect(logger.warn).toHaveBeenLastCalledWith(
            expect.objectContaining({
                message: expect.stringMatching(/Could not reinstate/)
            })
        );
        WebpackPEM.prototype.write.mockImplementationOnce(() => {
            throw 'cant do nothin';
        });
        trust();
        expect(OpenSSLCLI).not.toHaveBeenCalled();
    });
    describe('makes and tries to trust a cert', () => {
        const fakeKeyFile = {};
        const fakeCertFile = {};
        const fakePassIn = {};
        const fakePassOut = {};
        const fakeP12 = {};
        const fakeGoodPem = {};
        beforeEach(() => {
            WebpackPEM.prototype.write.mockImplementationOnce(() => {
                getPemInstance().exists = true;
            });
            TempFileMock.mockReturnValueOnce(fakeKeyFile).mockReturnValueOnce(
                fakeCertFile
            );
            OpenSSLCLI.createPassphrase
                .mockReturnValueOnce(fakePassIn)
                .mockReturnValueOnce(fakePassOut);
            OpenSSLCLI.prototype.createP12.mockReturnValueOnce(fakeP12);
            OpenSSLCLI.prototype.createImportablePEM.mockReturnValueOnce(
                fakeGoodPem
            );
        });
        it('succeeds and informs', () => {
            trust();
            expect(OpenSSLCLI.prototype.createP12).toHaveBeenCalledWith(
                fakeKeyFile,
                fakeCertFile,
                fakePassIn
            );
            expect(
                OpenSSLCLI.prototype.createImportablePEM
            ).toHaveBeenCalledWith(fakeP12, fakePassIn, fakePassOut);
            expect(SecurityCLI.prototype.addTrustedCert).toHaveBeenCalledWith(
                fakeGoodPem
            );
            expect(logger.info).toHaveBeenLastCalledWith(
                expect.stringContaining('should now trust')
            );
            expect(mockeryOfDeath).toHaveBeenCalledTimes(1);
            expect(proc.on).toHaveBeenCalledWith('exit', expect.any(Function));
        });
        it('fails and warns', () => {
            SecurityCLI.prototype.addTrustedCert.mockImplementationOnce(() => {
                throw 'woah';
            });
            trust();
            expect(logger.info).not.toHaveBeenCalledWith(
                expect.stringContaining('should now trust')
            );
            expect(mockeryOfDeath).not.toHaveBeenCalled();
            expect(proc.on).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                'Could not add trusted cert: ',
                'woah'
            );
        });
        describe('subscribes a death handler', () => {
            describe('tries to remove the trusted cert', () => {
                it('succeeds without incident', () => {
                    trust();
                    expect(deathHandler).not.toThrow();
                    expect(
                        SecurityCLI.prototype.removeTrustedCert
                    ).toHaveBeenCalledTimes(1);
                    expect(
                        SecurityCLI.prototype.removeTrustedCert
                    ).toHaveBeenCalledWith(fakeGoodPem);
                });
                it('fails to remove and warns', () => {
                    SecurityCLI.prototype.removeTrustedCert.mockImplementationOnce(
                        () => {
                            throw 'noooo';
                        }
                    );
                    trust();
                    expect(deathHandler).not.toThrow();
                    expect(logger.warn).toHaveBeenLastCalledWith(
                        expect.stringContaining(
                            'Could not remove trusted cert'
                        ),
                        'noooo'
                    );
                });
                it('only tries once', () => {
                    trust();
                    deathHandler();
                    deathHandler();
                    expect(
                        SecurityCLI.prototype.removeTrustedCert
                    ).toHaveBeenCalledTimes(1);
                });
            });
            it('throws any error it receives', () => {
                expect(() => deathHandler(null, {})).not.toThrow();
                expect(() =>
                    deathHandler(null, { message: 'lol' })
                ).not.toThrow();
                expect(() =>
                    deathHandler(null, { code: 1, message: 'lol' })
                ).toThrow('lol');
            });
            it('exits if it receives a SIGTERM', () => {
                expect(() => deathHandler('SIGTERM')).not.toThrow();
                expect(proc.exit).toHaveBeenCalledWith(143);
            });
        });
    });
});
