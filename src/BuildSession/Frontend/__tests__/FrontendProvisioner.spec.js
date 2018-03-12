const baseDir = '/some/basedir/';
const pkg = {};
jest.doMock(`${baseDir}package.json`, () => pkg, { virtual: true });
function mockPkg(json) {
    Object.keys(pkg).forEach(k => {
        delete pkg[k];
    });
    return Object.assign(pkg, json);
}
const FrontendProvisioner = require('../FrontendProvisioner');
const Environment = require('../../Environment');
const { Mode } = Environment;
const MockFrontendPreset = require('../__mocks__/MockFrontendPreset');
const MockDevProvisioner = MockFrontendPreset[Mode.DEVELOPMENT];

test('static get MAGENTO_SUPPORT_MODULE_NAME is an M2 module name', () => {
    expect(FrontendProvisioner.MAGENTO_SUPPORT_MODULE_NAME).toMatch(/\w+_\w+/);
});

test('has a lifecycle with resolvePaths and resolveDependencies steps', () => {
    expect(FrontendProvisioner.run).toBeInstanceOf(Function);
    expect(FrontendProvisioner.prototype.nowResolvePaths).toBeInstanceOf(
        Function
    );
    expect(FrontendProvisioner.prototype.nowResolveDependencies).toBeInstanceOf(
        Function
    );
});

test('get themeName and get themeVendor gets config from package.json and handles errors', () => {
    mockPkg({
        config: {
            magentoTheme: {
                name: 'hi',
                vendor: 'nobody'
            }
        }
    });
    const prov = new FrontendProvisioner();
    prov.config = { baseDir };
    expect(prov.themeName).toEqual('hi');
    expect(prov.themeVendor).toEqual('nobody');
});

test('getters from pkg handle errors', () => {
    mockPkg({});
    const prov = new FrontendProvisioner();
    prov.config = { baseDir };
    expect(() => prov.themeName).toThrow('Could not find');
});

test('#nowIdentify returns the M2 theme name', async () => {
    mockPkg({ config: { magentoTheme: { name: 'Example', vendor: 'Test' } } });
    const prov = new FrontendProvisioner();
    prov.config = { baseDir };
    await expect(prov.nowIdentify()).resolves.toBe('Test_Example');
});

test('get id returns _uniqueId if it provisioned, throws if not', async () => {
    const unprov = new MockDevProvisioner();
    await expect(() => unprov.id).toThrow('does not have an ID');
    const prov = await FrontendProvisioner.run(
        MockDevProvisioner,
        Environment.create(Mode.DEVELOPMENT),
        { baseDir }
    );
    expect(() => prov.id).not.toThrow();
    expect(prov.id).toBe('MockThemeVendor_MockThemeName');
});

test('resolvePaths wrapper checks for all required paths present and errors if not', async () => {
    class NoPaths extends MockDevProvisioner {
        async nowResolvePaths() {
            /* ¯\_(ツ)_/¯ */
        }
    }
    await expect(
        FrontendProvisioner.run(NoPaths, Environment.create(Mode.DEVELOPMENT), {
            baseDir
        })
    ).rejects.toThrow('paths must be an object');
    class BadPaths extends MockDevProvisioner {
        async nowResolvePaths() {
            return {
                root: 7,
                entry: /\?/
            };
        }
    }
    await expect(
        FrontendProvisioner.run(
            BadPaths,
            Environment.create(Mode.DEVELOPMENT),
            { baseDir }
        )
    ).rejects.toThrow('paths must at least include');
});

test('resolveDependencies wrapper expects an object with invalid and validityWarning props, warns if they are populated, and no-ops otherwise', async () => {
    class Verklempt extends MockDevProvisioner {
        async nowResolveDependencies() {
            return {
                invalid: ['cool', 'good'],
                validityWarning:
                    'cool@2.0.0 is out of date. good@1.0.2 is deprecated.'
            };
        }
    }
    jest.spyOn(console, 'warn');
    console.warn.mockImplementationOnce(() => {});
    await expect(
        FrontendProvisioner.run(
            Verklempt,
            Environment.create(Mode.DEVELOPMENT),
            { baseDir }
        )
    ).resolves.toBeDefined();
    expect(console.warn).toHaveBeenCalledWith(
        'Some dependencies are invalid:',
        expect.any(String)
    );
    console.warn.mockRestore();
    class Independent extends MockDevProvisioner {
        async nowResolveDependencies() {
            return null;
        }
    }
    await expect(
        FrontendProvisioner.run(
            Independent,
            Environment.create(Mode.DEVELOPMENT),
            { baseDir }
        )
    ).resolves.toBeDefined();
});
