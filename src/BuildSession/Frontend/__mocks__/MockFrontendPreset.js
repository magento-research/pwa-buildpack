const FrontendProvisioner = require('../FrontendProvisioner');
const Environment = require('../../Environment');
const DEV = Environment.Mode.DEVELOPMENT;
const PROD = Environment.Mode.PRODUCTION;

class MockFrontendProvisioner extends FrontendProvisioner {
    get themeName() {
        return 'MockThemeName';
    }
    get themeVendor() {
        return 'MockThemeVendor';
    }
    async nowConfigure() {
        return {
            baseDir: 'foo'
        };
    }
    async nowResolvePaths() {
        return {
            root: 'MockRoot',
            entry: 'MockEntry',
            output: 'MockOutput'
        };
    }
    async nowResolveDependencies() {
        return {
            invalid: []
        };
    }
}

class MockFrontendDevProvisioner extends MockFrontendProvisioner {}
class MockFrontendProdProvisioner extends MockFrontendProvisioner {}

module.exports = {
    [DEV]: MockFrontendDevProvisioner,
    [PROD]: MockFrontendProdProvisioner
};
