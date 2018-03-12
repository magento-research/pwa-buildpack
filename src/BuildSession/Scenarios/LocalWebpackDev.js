const {
    fs: { symlink, lstat, unlink },
    mkdirp
} = require('../../util/promisified');
const { join, dirname } = require('path');
const debug = require('../../util/debug').here(__filename);
const url = require('url');
const { Mode } = require('../Environment');
const Frontend = require('../Frontend');
const Backend = require('../Backend');
const DevServer = require('../../webpack/PWADevServer');
const Resolver = require('../../webpack/MagentoResolver');
const BuildSession = require('../BuildSession');

const removeTrailingSlash = x => x.replace(/\/$/, '');

const tryLStat = x =>
    lstat(x).catch(e => {
        if (e.code !== 'ENOENT') {
            throw e;
        }
    });

class LocalWebpackDev extends BuildSession {
    static SUPPORTED_MODES = [Mode.DEVELOPMENT];
    static SUPPORTED_FRONTEND_PROVISIONERS = [
        Frontend.presets.PeregrineApp[Mode.DEVELOPMENT]
    ];
    static SUPPORTED_BACKEND_PROVISIONERS = [
        Backend.presets.OSXLocalHosted[Mode.DEVELOPMENT],
        Backend.presets.VagrantVMHosted[Mode.DEVELOPMENT]
    ];
    constructor({ env, frontend, backend }) {
        debug('created');
        super({ env, frontend, backend });
        this.writeFrontendViewConfig = cfg => frontend.writeViewConfig(cfg);
        this.getFrontendViewConfigValue = v => frontend.getViewConfigValue(v);
        this.getSymlinkMap = () => frontend.getSymlinkMap();
        this.env = env;
        this.enableServiceWorkerDebugging = this.env.enableServiceWorkerDebugging;
        this.paths = frontend.paths;
        this.publicPath = backend.publicPath;
        this.backendDomain = backend.config.backendDomain.href;
        this.runtimeCacheAssetPath = frontend.config.runtimeCacheAssetPath;
        this.backendBaseDir = backend.config.baseDir;
        this.id = frontend.id;
    }
    async connect() {
        await Promise.all(
            Object.entries(this.getSymlinkMap()).map(
                async ([source, target]) => {
                    const frontendPath = this.paths[source];
                    const backendPath = removeTrailingSlash(
                        join(this.backendBaseDir, target)
                    );
                    debug(
                        `connect: symlinking frontend path ${source} to backend path ${target}`
                    );
                    try {
                        const stats = await tryLStat(backendPath);
                        if (stats && !stats.isSymbolicLink()) {
                            throw Error(`File already exists.`);
                        } else if (stats) {
                            debug(
                                `connect(): an existing symlink is in the way, removing`
                            );
                            await unlink(backendPath);
                        }
                        const dir = dirname(backendPath);
                        const dirstats = await tryLStat(dir);
                        if (!dirstats) {
                            await mkdirp(dirstats);
                        } else if (!dirstats.isDirectory()) {
                            throw Error(`${dir} already exists.`);
                        }
                        await symlink(frontendPath, backendPath);
                        debug(
                            `connect(): linked ${frontendPath} to ${backendPath}`
                        );
                    } catch (e) {
                        throw Error(
                            debug.errorMsg(
                                `Cannot symlink ${frontendPath} => ${backendPath}. ${
                                    e.message
                                }`
                            )
                        );
                    }
                }
            )
        );
        this.serviceWorkerFileName = await this.getFrontendViewConfigValue(
            'serviceworker_name'
        );
        this.devServer = await DevServer.configure(this);
        this.resolve = await Resolver.configure(this);
        await this.writeFrontendViewConfig({
            devserver_host: url.format({
                protocol: 'https:',
                host: this.devServer.host,
                pathname: '/'
            }),
            devserver_port: this.devServer.port
        });
    }
    envToVars() {
        const vars = Object.assign({}, super.envToVars());
        vars.SERVICE_WORKER_FILE_NAME = this.enableServiceWorkerDebugging
            ? this.serviceWorkerFileName
            : 'SERVICE_WORKER_DISABLED_IN_DEV';
        return vars;
    }
}
module.exports = LocalWebpackDev;
