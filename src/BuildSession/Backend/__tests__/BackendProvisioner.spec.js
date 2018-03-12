const Environment = require('../../Environment');
const BackendProvisioner = require('../BackendProvisioner');

test('has a lifecycle with connect() and prepare() steps', () => {
    expect(BackendProvisioner.run).toBeInstanceOf(Function);
    expect(BackendProvisioner.prototype.nowConfigure).toBeInstanceOf(Function);
    expect(BackendProvisioner.prototype.nowConnect).toBeInstanceOf(Function);
    expect(BackendProvisioner.prototype.nowPrepare).toBeInstanceOf(Function);
});

test('connect phase checks for HostOSAdapter', async () => {
    // the base BackendProvisioner won't create a HostOSAdapter
    await expect(
        BackendProvisioner.run(
            BackendProvisioner,
            Environment.create(Environment.Mode.DEVELOPMENT),
            {}
        )
    ).rejects.toThrowError('connect phase must produce a HostOSAdapter');
});
