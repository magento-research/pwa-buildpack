const debug = require('../../../util/debug').here(__filename);
const { Mode } = require('../../Environment');
const DevMode = require('../Provisioners/DevMode');
const ProductionMode = require('../Provisioners/ProductionMode');
const VagrantVMAdapter = require('../HostOSAdapters/VagrantVMAdapter');
const SSLConfigurator = require('../../SSLConfigurator');
const updateMagentoConfig = require('../updateMagentoConfig');

class VagrantVMHostedDev extends DevMode {
    async nowConfigure(config, ...args) {
        const processed = await super.nowConfigure(config, ...args);
        processed.configureSSL = processed.configureSSL || {
            httpdConfPath: '/etc/apache2/sites-available/magento2.conf',
            httpdAssetPath: '/etc/ssl/',
            restartCmd: 'sudo a2enmod ssl && sudo service apache2 restart'
        };
        if (!config.vmName) {
            throw Error(
                debug.errorMsg(
                    `configure(): config property 'vmName' is required to be a Vagrant machine name: `,
                    config
                )
            );
        }
        processed.vmName = config.vmName;
        return processed;
    }
    async nowConnect() {
        const hostOS = new VagrantVMAdapter({ vmName: this.config.vmName });
        await hostOS.connect();
        return hostOS;
    }
    async nowPrepare(...args) {
        await super.nowPrepare(...args);
        debug(`nowPrepare(): adding SSL to web server on host OS`);
        const sslConfig = await SSLConfigurator.provide(
            'vagrant',
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

class VagrantVMHostedProd extends ProductionMode {
    async nowPrepare(...args) {
        await super.nowPrepare(...args);
        await this.hostOS.exec('bin/magento cache:clean');
    }
}

module.exports = {
    [Mode.DEVELOPMENT]: VagrantVMHostedDev,
    [Mode.PRODUCTION]: VagrantVMHostedProd
};
