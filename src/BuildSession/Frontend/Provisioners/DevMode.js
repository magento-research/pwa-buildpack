const { URL } = require('url');
const debug = require('../../../util/debug').here(__filename);
const { fs } = require('../../../util/promisified');
const FrontendProvisioner = require('../FrontendProvisioner');

class FrontendDevModeProvisioner extends FrontendProvisioner {
    getSymlinkMap() {
        if (this.config.symlinkToBackend === false) {
            return {};
        } else {
            return (
                this.config.symlinkToBackend || {
                    root: `app/design/frontend/${this.themeVendor}/${
                        this.themeName
                    }/`
                }
            );
        }
    }
    async nowConfigure(config) {
        /* istanbul ignore else: throw short-circuit */
        if (typeof config.baseDir !== 'string') {
            throw Error(
                debug.errorMsg(
                    `nowConfigure(): config property 'baseDir' is required to be a string filesystem path: `,
                    config
                )
            );
        }
        const [backendDomain, runtimeCacheAssetPath] = [
            config.backendDomain,
            config.runtimeCacheAssetPath
        ].map(value => {
            if (typeof value === 'string') {
                return new URL(value).href;
            } else if (value && value.href) {
                return value.href;
            }
        });
        if (!backendDomain) {
            throw Error(
                debug.errorMsg(
                    `nowConfigure(): config property 'backendDomain' is required to be either a string URL or a URL object: ${backendDomain}`
                )
            );
        }
        // throw if the directory doesn't exist
        const baseDir = await fs.realpath(config.baseDir);

        const symlinkToBackend = config.symlinkToBackend;

        return {
            baseDir,
            backendDomain,
            runtimeCacheAssetPath,
            symlinkToBackend
        };
    }
}

module.exports = FrontendDevModeProvisioner;
