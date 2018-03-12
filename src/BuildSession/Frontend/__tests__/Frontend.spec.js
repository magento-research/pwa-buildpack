const Frontend = require('../');
const FrontendProvisioner = require('../FrontendProvisioner');
const Environment = require('../../Environment');
const DEV = Environment.Mode.DEVELOPMENT;
const PROD = Environment.Mode.PRODUCTION;
const MockFrontendPreset = require('../__mocks__/MockFrontendPreset');
const {
    [DEV]: MockFrontendDevProvisioner,
    [PROD]: MockFrontendProdProvisioner
} = MockFrontendPreset;

test('static get presets() returns a list of presets', () => {
    const { presets } = Frontend;
    Object.keys(presets).forEach(key => {
        expect(presets[key]).toHaveProperty(DEV);
        expect(presets[key][DEV].prototype).toBeInstanceOf(FrontendProvisioner);
        expect(presets[key]).toHaveProperty(PROD);
        expect(presets[key][PROD].prototype).toBeInstanceOf(
            FrontendProvisioner
        );
    });
});

test('static develop() takes a preset object of mode names to provisioner classes and runs the Development one', async () => {
    await expect(
        Frontend.develop(MockFrontendPreset, new Environment(DEV), {})
    ).resolves.toBeDefined();
});
test('static develop() takes a provisioner directly and runs it', async () => {
    await expect(
        Frontend.develop(MockFrontendDevProvisioner, new Environment(DEV), {})
    ).resolves.toBeDefined();
});

test('static provide() takes a preset object of mode names to provisioner classes and runs the Production one', async () => {
    await expect(
        Frontend.compile(MockFrontendPreset, new Environment(PROD), {})
    ).resolves.toBeDefined();
});

test('static provide() takes a provisioner directly and runs it', async () => {
    await expect(
        Frontend.compile(MockFrontendProdProvisioner, new Environment(PROD), {})
    ).resolves.toBeDefined();
});
