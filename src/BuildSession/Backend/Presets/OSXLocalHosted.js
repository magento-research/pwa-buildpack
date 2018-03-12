const debug = require('../../../util/debug').here(__filename);
const { Mode } = require('../../Environment');
const DevMode = require('../Provisioners/DevMode');
const ProductionMode = require('../Provisioners/ProductionMode');
const HostOSAdapter = require('../HostOSAdapter');
const SSLConfigurator = require('../../SSLConfigurator');
const updateMagentoConfig = require('../updateMagentoConfig');

class OSXLocalHostedDev extends DevMode {
    async nowConfigure(config, ...args) {
        const processed = await super.nowConfigure(config, ...args);
        processed.configureSSL = processed.configureSSL || {
            httpdConfPath: '/usr/local/etc/httpd/httpd-magento2.conf',
            httpdAssetPath: '/usr/local/etc/httpd/',
            restartCmd: 'brew services restart httpd'
        };
        return processed;
    }
    async nowConnect() {
        const hostOS = new HostOSAdapter({ cwd: this.config.baseDir });
        await hostOS.connect();
        return hostOS;
    }
    async nowPrepare(...args) {
        await super.nowPrepare(...args);
        debug(`nowPrepare(): adding SSL to web server on host OS`);
        const sslConfig = await SSLConfigurator.provide(
            'osx',
            'apache2',
            Object.assign(
                {
                    baseDir: this.config.baseDir,
                    backendDomain: this.config.backendDomain,
                    hostOS: this.hostOS
                },
                this.config.configureSSL
            )
        );
        this.backendDomain =
            sslConfig.newBackendDomain || this.config.backendDomain;
        const mcfg = await updateMagentoConfig({
            baseDir: this.config.baseDir,
            hostOS: this.hostOS,
            requiredConfig: this.getRequiredConfigValues()
        });
        if (!mcfg) {
            throw Error(
                'Unable to update and retrieve Magento config. Make sure your store is online!'
            );
        }
        this.publicPath = mcfg.publicPath;
        debug(`nowPrepare(): successfully updated M2 config`);
        await this.hostOS.exec('bin/magento cache:clean');
    }
}

class OSXLocalHostedProd extends ProductionMode {
    async nowPrepare(...args) {
        await super.nowPrepare(...args);
        await this.hostOS.exec('bin/magento cache:clean');
    }
}

module.exports = {
    [Mode.DEVELOPMENT]: OSXLocalHostedDev,
    [Mode.PRODUCTION]: OSXLocalHostedProd
};
