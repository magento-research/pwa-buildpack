const { resolve } = require('path');
const debug = require('../../util/debug').here(__filename);
const lget = require('lodash.get');
const HasLifecycle = require('../HasLifecycle');

class FrontendProvisioner {
    static get MAGENTO_SUPPORT_MODULE_NAME() {
        return 'Magento_Pwa';
    }
    _getPkgValue(dotPath) {
        const pkgPath = resolve(this.config.baseDir, 'package.json');
        try {
            if (!this._pkg) {
                this._pkg = require(pkgPath);
            }
            const nope = () => {
                throw Error(`Could not find path ${dotPath}`);
            };
            const value = lget(this._pkg, dotPath, nope);
            if (value === nope) {
                nope();
            }
            return value;
        } catch (e) {
            throw Error(
                debug.errorMsg(
                    `Could not find a usable ${pkgPath} file. A Magento PWA frontend requires a package.json file with a config: { magentoTheme: { vendor, name } } present. ${
                        e.message
                    }`
                )
            );
        }
    }
    get themeName() {
        return this._getPkgValue('config.magentoTheme.name');
    }
    get themeVendor() {
        return this._getPkgValue('config.magentoTheme.vendor');
    }
    get id() {
        if (!this._uniqueId) {
            throw Error(`This provisioner has not run and does not have an ID`);
        }
        return this._uniqueId;
    }
    /* istanbul ignore next: base implementations don't need testing */
    async nowConfigure() {}
    /* istanbul ignore next: base implementations don't need testing */
    async nowResolvePaths() {}
    /* istanbul ignore next: base implementations don't need testing */
    async nowResolveDependencies() {}
    async nowPrepareWorkspace() {}
    async nowIdentify() {
        return `${this.themeVendor}_${this.themeName}`;
    }
}

module.exports = HasLifecycle(FrontendProvisioner, {
    name: 'FrontendProvisioner',
    lifecycle: [
        {
            name: 'resolvePaths',
            async run(self, cb) {
                self.paths = await cb();
                debug(`this.paths assigned: `, self.paths);
                if (typeof self.paths !== 'object') {
                    throw Error(debug.errorMsg(`paths must be an object`));
                }
                if (
                    ['root', 'entry', 'output'].some(
                        p => typeof self.paths[p] !== 'string'
                    )
                ) {
                    throw Error(
                        debug.errorMsg(
                            `paths must at least include 'root', 'entry', and 'output'`
                        )
                    );
                }
            }
        },
        {
            name: 'resolveDependencies',
            async run(self, cb) {
                self.dependencies = (await cb()) || {};
                const { invalid, validityWarning } = self.dependencies;
                if (invalid && invalid.length > 0) {
                    console.warn(
                        `Some dependencies are invalid:`,
                        validityWarning
                    );
                }
            }
        },
        {
            name: 'prepareWorkspace',
            parallel: true,
            async run(self, cb) {
                await cb();
            }
        },
        {
            name: 'identify',
            parallel: true,
            async run(self, cb) {
                self._uniqueId = await cb();
            }
        }
    ]
});
