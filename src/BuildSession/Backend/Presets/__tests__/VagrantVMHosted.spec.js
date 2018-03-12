jest.mock('../../Provisioners/DevMode');
jest.mock('../../Provisioners/ProductionMode');
jest.mock('../../HostOSAdapters/VagrantVMAdapter');
jest.mock('../../updateMagentoConfig');
jest.mock('../../../SSLConfigurator');

const { Mode } = require('../../../Environment');
const DevMode = require('../../Provisioners/DevMode');
const SSLConfigurator = require('../../../SSLConfigurator');
const updateMagentoConfig = require('../../updateMagentoConfig');
const VagrantVMAdapter = require('../../HostOSAdapters/VagrantVMAdapter');
const ProductionMode = require('../../Provisioners/ProductionMode');
const VagrantVMHosted = require('../VagrantVMHosted');

beforeEach(() => jest.resetAllMocks());

test('has implementations for each environment mode', () => {
    expect(VagrantVMHosted[Mode.DEVELOPMENT].prototype).toBeInstanceOf(DevMode);
    expect(VagrantVMHosted[Mode.PRODUCTION].prototype).toBeInstanceOf(
        ProductionMode
    );
});

test('dev#nowConfigure runs super method and adds configureSSL or default fallback, and vmName', async () => {
    let prov = new VagrantVMHosted[Mode.DEVELOPMENT]();
    const configureSSL = {};
    const config = { configureSSL, vmName: 'magento2.vagrant' };
    const emptyConfig = { vmName: 'magento2.vagrant' };
    DevMode.prototype.nowConfigure.mockResolvedValueOnce({});
    await prov.nowConfigure(config, 'foo');
    expect(DevMode.prototype.nowConfigure).toHaveBeenCalledWith(config, 'foo');
    DevMode.prototype.nowConfigure.mockClear();
    DevMode.prototype.nowConfigure.mockResolvedValueOnce({});
    prov = new VagrantVMHosted[Mode.DEVELOPMENT]();
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

test('dev#nowConfigure throws if no vmName', async () => {
    const prov = new VagrantVMHosted[Mode.DEVELOPMENT]();
    DevMode.prototype.nowConfigure.mockResolvedValueOnce({});
    await expect(prov.nowConfigure({})).rejects.toThrow(
        'required to be a Vagrant machine'
    );
});

let prov;
function mockProv(mode) {
    prov = new VagrantVMHosted[mode]();
    prov.hostOS = {
        exec: jest.fn()
    };
    prov.config = {
        baseDir: 'somedir',
        backendDomain: 'somedomain',
        configureSSL: {
            sslThing: 'woah'
        },
        vmName: 'magento2.vagrant'
    };
}

test('dev#nowConnect connects VagrantVMAdapter', async () => {
    const prov = new VagrantVMHosted[Mode.DEVELOPMENT]();
    prov.config = {
        vmName: 'magento2.vagrant'
    };
    DevMode.prototype.nowConfigure.mockResolvedValueOnce({});
    const adapter = await prov.nowConnect();
    expect(adapter).toBeInstanceOf(VagrantVMAdapter);
});

test('dev#nowPrepare runs supSSLConfigurator to set certs, accepts changes', async () => {
    mockProv(Mode.DEVELOPMENT);
    SSLConfigurator.provide.mockResolvedValueOnce({});
    updateMagentoConfig.mockResolvedValueOnce({});
    await prov.nowPrepare('lol');
    expect(SSLConfigurator.provide).toHaveBeenCalledWith(
        'vagrant',
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
