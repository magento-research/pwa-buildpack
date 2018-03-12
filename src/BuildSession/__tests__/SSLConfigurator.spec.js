jest.mock('../../util/promisified');
jest.mock('../../util/ssl-cert-store');

const { URL } = require('url');
const { apacheconf } = require('../../util/promisified');
const SSLCertStore = require('../../util/ssl-cert-store');

const MockHostOS = jest.genMockFromModule('../Backend/HostOSAdapter');
const mockHostOS = new MockHostOS();

const SSLConfigurator = require('../SSLConfigurator');

let options;

beforeEach(() => {
    mockHostOS.readFile.mockResolvedValueOnce('httpd conf');
    SSLCertStore.provide.mockResolvedValueOnce({
        key: 'fakeKey',
        cert: 'fakeCert'
    });
    options = {
        baseDir: 'baseDir',
        backendDomain: 'https://backend.domain',
        hostOS: mockHostOS,
        httpdConfPath: 'httpdConfPath',
        httpdAssetPath: 'httpdAssetPath',
        restartCmd: 'omg reboot'
    };
});

test('static async provide validates serverType', async () => {
    await expect(SSLConfigurator.provide(null, null)).rejects.toThrowError(
        'Unknown HTTP server type'
    );
});

test('errors informatively if it does not get options it wants', async () => {
    await expect(
        SSLConfigurator.provide('osx', 'apache2', {})
    ).rejects.toThrowError('missing options');
});

test('validates confType', async () => {
    await expect(
        SSLConfigurator.provide('beos', 'apache2', {})
    ).rejects.toThrowError('Unknown host type');
});

test('supports apache2 with an async configurator method', async () => {
    apacheconf.mockResolvedValueOnce({});
    await expect(
        SSLConfigurator.provide('osx', 'apache2', options)
    ).resolves.toBeTruthy();
});

test('supports vagrant confType also', async () => {
    apacheconf.mockResolvedValueOnce({});
    await expect(
        SSLConfigurator.provide('vagrant', 'apache2', options)
    ).resolves.toBeTruthy();
});

test('backendDomain option can be a string hostname or a URL', async () => {
    apacheconf.mockResolvedValueOnce({});
    options.backendDomain = new URL('https://backend.domain');
    await expect(
        SSLConfigurator.provide('vagrant', 'apache2', options)
    ).resolves.toBeTruthy();
});

test('looks for existing secure config before creating new', async () => {
    apacheconf.mockResolvedValueOnce({
        IfModule: [
            {
                $args: 'ssl_module',
                VirtualHost: [
                    {
                        $args: '*:8443',
                        ServerName: 'backend.domain'
                    }
                ]
            }
        ]
    });
    await SSLConfigurator.provide('osx', 'apache2', options);
    expect(SSLCertStore.provide).not.toHaveBeenCalled();
    apacheconf.mockResolvedValueOnce({
        IfModule: [
            {
                $args: 'unrecognized',
                VirtualHost: [
                    {
                        $args: '*:8443',
                        ServerName: 'backend.domain'
                    }
                ]
            },
            {
                $args: 'ssl_module',
                VirtualHost: [
                    {
                        $args: '*:8024',
                        ServerName: 'backend.domain'
                    }
                ]
            },
            {
                $args: 'ssl_module',
                VirtualHost: [
                    {
                        $args: '*:8443',
                        ServerName: 'wrong.domain'
                    }
                ]
            }
        ]
    });
    await SSLConfigurator.provide('osx', 'apache2', options);
    expect(SSLCertStore.provide).toHaveBeenCalled();
});

test('errors if HTTPS port is already bound', async () => {
    apacheconf.mockResolvedValueOnce({
        Listen: [8443]
    });
    options.backendDomain = 'https://localhost';
    await expect(
        SSLConfigurator.provide('osx', 'apache2', options)
    ).rejects.toThrowError('Local SSL port 8443 already bound');
});

test('gets credentials for backendDomain from SSLCertStore', async () => {
    apacheconf.mockResolvedValueOnce({});
    const { newBackendDomain } = await SSLConfigurator.provide(
        'osx',
        'apache2',
        options
    );
    expect(newBackendDomain).toBe('https://backend.domain');
    expect(SSLCertStore.provide).toHaveBeenCalled();
});

test('backs up old httpd.conf, writes key and cert files, writes new httpd.conf', async () => {
    apacheconf.mockResolvedValueOnce({});
    await SSLConfigurator.provide('osx', 'apache2', options);
    expect(mockHostOS.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/^httpdConfPath\.bak\-/),
        'httpd conf'
    );
    expect(mockHostOS.writeFile).toHaveBeenCalledWith(
        'httpdConfPath',
        expect.stringMatching(/^httpd conf/)
    );
    expect(mockHostOS.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(
            /httpdAssetPath\/private\/pwa\-apache\-ssl\.key$/
        ),
        'fakeKey'
    );
    expect(mockHostOS.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/httpdAssetPath\/certs\/pwa\-apache\-ssl\.crt$/),
        'fakeCert'
    );
});

test('tries restart command and other alternatives');
