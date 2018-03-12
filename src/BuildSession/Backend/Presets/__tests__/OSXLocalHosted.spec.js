jest.mock('../../Provisioners/DevMode');
jest.mock('../../Provisioners/ProductionMode');
jest.mock('../../HostOSAdapter');
jest.mock('../../updateMagentoConfig');
jest.mock('../../../SSLConfigurator');

const { Mode } = require('../../../Environment');
const DevMode = require('../../Provisioners/DevMode');
const SSLConfigurator = require('../../../SSLConfigurator');
const updateMagentoConfig = require('../../updateMagentoConfig');
const HostOSAdapter = require('../../HostOSAdapter');
const ProductionMode = require('../../Provisioners/ProductionMode');
const OSXLocalHosted = require('../OSXLocalHosted');

beforeEach(() => jest.resetAllMocks());

test('has implementations for each environment mode', () => {
    expect(OSXLocalHosted[Mode.DEVELOPMENT].prototype).toBeInstanceOf(DevMode);
    expect(OSXLocalHosted[Mode.PRODUCTION].prototype).toBeInstanceOf(
        ProductionMode
    );
});

test('dev#nowConfigure runs super method and adds configureSSL or default fallback', async () => {
    let prov = new OSXLocalHosted[Mode.DEVELOPMENT]();
    const configureSSL = {};
    const config = { configureSSL };
    const emptyConfig = {};
    DevMode.prototype.nowConfigure.mockResolvedValueOnce({});
    await prov.nowConfigure(config, 'foo');
    expect(DevMode.prototype.nowConfigure).toHaveBeenCalledWith(config, 'foo');
    DevMode.prototype.nowConfigure.mockClear();
    DevMode.prototype.nowConfigure.mockResolvedValueOnce({});
    prov = new OSXLocalHosted[Mode.DEVELOPMENT]();
    const processed = await prov.nowConfigure(emptyConfig, 'bar');
    expect(DevMode.prototype.nowConfigure).toHaveBeenCalledWith(
        emptyConfig,
        'bar'
    );
    expect(processed.configureSSL).toMatchObject({
        httpdConfPath: expect.stringMatching(/^\//),
        httpdAssetPath: expect.stringMatching(/^\//),
        restartCmd: expect.any(String)
    });
});

test('dev#nowConnect connects plain HostOSAdapter', async () => {
    const prov = new OSXLocalHosted[Mode.DEVELOPMENT]();
    prov.config = { baseDir: 'somedir' };
    const adapter = await prov.nowConnect();
    expect(adapter).toBeInstanceOf(HostOSAdapter);
    expect(HostOSAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
            cwd: 'somedir'
        })
    );
    expect(adapter.connect).toHaveBeenCalled();
});

let prov;
function mockProv(mode) {
    prov = new OSXLocalHosted[mode]();
    prov.hostOS = {
        exec: jest.fn()
    };
    prov.config = {
        baseDir: 'somedir',
        backendDomain: 'somedomain',
        configureSSL: {
            sslThing: 'woah'
        }
    };
}

test('dev#nowPrepare runs SSLConfigurator to set certs, accepts changes', async () => {
    mockProv(Mode.DEVELOPMENT);
    SSLConfigurator.provide.mockResolvedValueOnce({});
    updateMagentoConfig.mockResolvedValueOnce({});
    await prov.nowPrepare('lol');
    expect(DevMode.prototype.nowPrepare).toHaveBeenCalledWith('lol');
    expect(SSLConfigurator.provide).toHaveBeenCalledWith(
        'osx',
        'apache2',
        expect.objectContaining({
            baseDir: 'somedir',
            backendDomain: 'somedomain',
            hostOS: prov.hostOS,
            sslThing: 'woah'
        })
    );
    expect(prov.backendDomain).toBe('somedomain');

    mockProv(Mode.DEVELOPMENT);
    SSLConfigurator.provide.mockResolvedValueOnce({
        newBackendDomain: 'securedomain'
    });
    updateMagentoConfig.mockResolvedValueOnce({});
    await prov.nowPrepare();
    expect(prov.backendDomain).toBe('securedomain');
});

test('dev#nowPrepare runs updateMagentoConfig, sets publicPath and errors informatively if necessary', async () => {
    mockProv(Mode.DEVELOPMENT);
    SSLConfigurator.provide.mockResolvedValueOnce({});
    updateMagentoConfig.mockResolvedValueOnce({
        publicPath: 'somepublicpath'
    });
    await prov.nowPrepare();
    expect(updateMagentoConfig).toHaveBeenCalledWith(
        expect.objectContaining({
            baseDir: 'somedir',
            hostOS: prov.hostOS,
            requiredConfig: undefined
        })
    );
    expect(prov.publicPath).toBe('somepublicpath');

    mockProv(Mode.DEVELOPMENT);
    SSLConfigurator.provide.mockResolvedValueOnce({});
    await expect(prov.nowPrepare()).rejects.toThrowError(
        'Unable to update and retrieve'
    );
});

test('dev#nowPrepare flushes M2 cache', async () => {
    mockProv(Mode.DEVELOPMENT);
    SSLConfigurator.provide.mockResolvedValueOnce({});
    updateMagentoConfig.mockResolvedValueOnce({
        publicPath: 'somepublicpath'
    });
    await prov.nowPrepare();
    expect(prov.hostOS.exec).toHaveBeenCalledWith('bin/magento cache:clean');
});

test('prod#nowPrepare runs supermethod and cleans cache', async () => {
    mockProv(Mode.PRODUCTION);
    await prov.nowPrepare('hey');
    expect(SSLConfigurator.provide).not.toHaveBeenCalled();
    expect(ProductionMode.prototype.nowPrepare).toHaveBeenCalledWith('hey');
    expect(prov.hostOS.exec).toHaveBeenCalledWith('bin/magento cache:clean');
});
