const Backend = require('../');
const BackendProvisioner = require('../BackendProvisioner');
const HostOSAdapter = require('../HostOSAdapter');
const Environment = require('../../Environment');

class FakeProvisioner extends BackendProvisioner {
    async nowConnect() {
        return new HostOSAdapter({
            cwd: '',
            exec: () => '',
            readFile: () => '',
            writeFile: () => '',
            stat: () => ''
        });
    }
}
class FakeDevProvisioner extends FakeProvisioner {}
class FakeProductionProvisioner extends FakeProvisioner {}
const FakePreset = {
    [Environment.Mode.DEVELOPMENT]: FakeDevProvisioner,
    [Environment.Mode.PRODUCTION]: FakeProductionProvisioner
};

test('static get presets returns a list of builtin presets', () => {
    expect(Backend.presets).toMatchObject({
        OSXLocalHosted: expect.anything(),
        VagrantVMHosted: expect.anything()
    });
});

test('static develop() takes a preset object of mode names to provisioner classes and runs the Development one', async () => {
    const instance = await Backend.develop(
        FakePreset,
        Environment.create(Environment.Mode.DEVELOPMENT)
    );
    expect(instance).toBeInstanceOf(FakeDevProvisioner);
});

test('static develop() can also just take a provisioner', async () => {
    const instance = await Backend.develop(
        FakeDevProvisioner,
        Environment.create(Environment.Mode.DEVELOPMENT)
    );
    expect(instance).toBeInstanceOf(FakeDevProvisioner);
});

test('static provide() takes a preset object of mode names to provisioner classes and runs the Production one', async () => {
    const instance = await Backend.provide(
        FakePreset,
        Environment.create(Environment.Mode.PRODUCTION)
    );
    expect(instance).toBeInstanceOf(FakeProductionProvisioner);
});

test('static provide() can also just take a provisioner', async () => {
    const instance = await Backend.provide(
        FakeProductionProvisioner,
        Environment.create(Environment.Mode.PRODUCTION)
    );
    expect(instance).toBeInstanceOf(FakeProductionProvisioner);
});
