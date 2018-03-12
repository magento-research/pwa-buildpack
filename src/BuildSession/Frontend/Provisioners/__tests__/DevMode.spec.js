jest.mock('../../../../util/promisified/fs');

const { URL } = require('url');
const DevMode = require('../DevMode');
const FrontendProvisioner = require('../../FrontendProvisioner');
const fs = require('../../../../util/promisified/fs');

const baseDir = '/some/great/dir';
const pkg = {};
jest.doMock(`${baseDir}/package.json`, () => pkg, { virtual: true });
function mockPkg(json) {
    Object.keys(pkg).forEach(k => {
        delete pkg[k];
    });
    return Object.assign(pkg, json);
}

test('extends FrontendProvisioner', () => {
    expect(DevMode.prototype).toBeInstanceOf(FrontendProvisioner);
});

test('#getSymlinkMap checks for symlinkToBackend config and returns that or defaults', () => {
    mockPkg({
        config: {
            magentoTheme: {
                vendor: 'Boom',
                name: 'Bap'
            }
        }
    });
    let prov = new DevMode();
    prov.config = { baseDir, symlinkToBackend: false };
    expect(prov.getSymlinkMap()).toEqual({});

    mockPkg({
        config: {
            magentoTheme: {
                vendor: 'Boom',
                name: 'Bap'
            }
        }
    });
    prov = new DevMode();
    prov.config = { baseDir, symlinkToBackend: { output: 'bluh' } };
    expect(prov.getSymlinkMap()).toEqual({
        output: 'bluh'
    });

    mockPkg({
        config: {
            magentoTheme: {
                vendor: 'Boom',
                name: 'Bap'
            }
        }
    });
    prov = new DevMode();
    prov.config = { baseDir };
    expect(prov.getSymlinkMap()).toEqual({
        root: 'app/design/frontend/Boom/Bap/'
    });
});

test('#nowConfigure checks for baseDir, logs if it is relative', async () => {
    const prov = new DevMode();
    await expect(prov.nowConfigure({})).rejects.toThrow(
        "baseDir' is required to be a string filesystem path"
    );
});

test('#nowConfigure accepts either a URL or a string for backendDomain, errors otherwise', async () => {
    fs.realpath.mockResolvedValueOnce('/absolute/basedir');
    const prov = new DevMode();
    await expect(prov.nowConfigure({ baseDir })).rejects.toThrow(
        "backendDomain' is required"
    );
    await expect(
        prov.nowConfigure({ baseDir, backendDomain: 'yo' })
    ).rejects.toThrow('Invalid URL');
    await expect(
        prov.nowConfigure({ baseDir, backendDomain: 'https://example.com' })
    ).resolves.toBeDefined();
    await expect(
        prov.nowConfigure({
            baseDir,
            backendDomain: new URL('https://example.com')
        })
    ).resolves.toBeDefined();
});
