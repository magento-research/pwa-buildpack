const FrontendProvisioner = require('../../FrontendProvisioner');
const ProductionMode = require('../ProductionMode');

test('extends extends FrontendProvisioner', () => {
    expect(ProductionMode.prototype).toBeInstanceOf(FrontendProvisioner);
});
