const BackendProvisioner = require('../../BackendProvisioner');
const ProductionMode = require('../ProductionMode');

test('extends BackendProvisioner', () => {
    expect(new ProductionMode()).toBeInstanceOf(BackendProvisioner);
});
