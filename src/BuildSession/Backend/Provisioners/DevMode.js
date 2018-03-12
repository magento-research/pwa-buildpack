const BackendProvisioner = require('../BackendProvisioner');

class BackendDevModeProvisioner extends BackendProvisioner {
    getRequiredConfigValues() {
        let { backendDomain } = this.config;
        const hasTrailingSlash =
            backendDomain[backendDomain.length - 1] === '/';
        if (!hasTrailingSlash) {
            backendDomain += '/';
        }
        return {
            'web/unsecure/base_url': backendDomain,
            'web/secure/base_url': backendDomain,
            'dev/template/allow_symlink': 1,
            'dev/static/sign': 0,
            'web/secure/use_in_frontend': 1,
            'web/secure/use_in_adminhtml': 1
        };
    }
}

module.exports = BackendDevModeProvisioner;
