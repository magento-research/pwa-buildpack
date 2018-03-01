const GlobalConfig = require('./global-config');
const debug = require('./debug').here(__filename);
const { exec } = require('./promisified/child_process');
const runAsRoot = require('./run-as-root');

module.exports = class SSLCertStore {
    static userCerts = new GlobalConfig({
        prefix: 'devcert',
        key: x => x
    });
    // treat a certificate as basically expired if it'll expire in 1 day (86400s)
    static async expired(cert) {
        return exec(`openssl x509 -checkend 0 <<< "${cert}"`)
            .then(() => false)
            .catch(({ stdout }) => stdout.trim() === 'Certificate will expire');
    }
    static async provide(commonName) {
        if (typeof commonName !== 'string') {
            throw Error(
                debug.errorMsg(
                    `Must provide a commonName to SSLCertStore.provide(). Instead, argument was ${commonName}`
                )
            );
        }
        let certPair = await this.userCerts.get(commonName);
        if (certPair && (await this.expired(certPair.cert))) {
            certPair = null;
            await this.userCerts.del(commonName);
        }
        if (!certPair) {
            certPair = await this.create(commonName);
            await this.userCerts.set(commonName, certPair);
        }
        return certPair;
    }
    static async create(commonName) {
        try {
            return JSON.parse(
                await runAsRoot(
                    /* istanbul ignore next: this runs out of band in another process, hard to test */
                    async name => {
                        const devcert = require('@magento/devcert');
                        const certs = await devcert(name);
                        process.stdout.write(JSON.stringify(certs));
                    },
                    commonName
                )
            );
        } catch (e) {
            throw Error(
                debug.errorMsg(
                    `Error generating dev certificate: ${e.message} ${e.stack}`
                )
            );
        }
    }
};
