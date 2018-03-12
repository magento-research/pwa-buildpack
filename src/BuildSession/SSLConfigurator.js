const os = require('os');
const debug = require('../util/debug').here(__filename);
const url = require('url');
const path = require('path');
const { fs, apacheconf } = require('../util/promisified');
const lget = require('lodash.get');
const SSLCertStore = require('../util/ssl-cert-store');

const localSSLPort = 8443;

const hasSecureVHost = (directive, hostname) =>
    lget(directive, 'VirtualHost', []).some(
        vhost =>
            vhost.$args.match(/443$/) && vhost.ServerName.includes(hostname)
    );

const confTypes = {
    vagrant({ baseDir, hostname, sslKeyFile, sslCertFile }) {
        return `<IfModule ssl_module>
    <VirtualHost *:443>
        ServerName ${hostname}
        SSLEngine on
        SSLCertificateFile "${sslCertFile}"
        SSLCertificateKeyFile "${sslKeyFile}"
        DocumentRoot "${baseDir}"
        <Directory "${baseDir}">
            Options Indexes FollowSymLinks
            AllowOverride All
            Require all granted
        </Directory>
        ErrorLog "/error.log"
        CustomLog "/access.log" common
    </VirtualHost>
</IfModule>
`;
    },
    osx({ baseDir, hostname, sslKeyFile, sslCertFile }) {
        return `
        LoadModule ssl_module lib/httpd/modules/mod_ssl.so
        LoadModule socache_shmcb_module lib/httpd/modules/mod_socache_shmcb.so
        LoadModule suexec_module lib/httpd/modules/mod_suexec.so
        Listen ${localSSLPort}
        SSLCipherSuite HIGH:MEDIUM:!MD5:!RC4:!3DES
        SSLProxyCipherSuite HIGH:MEDIUM:!MD5:!RC4:!3DES
        SSLHonorCipherOrder on
        SSLProtocol all -SSLv3
        SSLProxyProtocol all -SSLv3
        SSLPassPhraseDialog  builtin
        SSLSessionCache        "shmcb:/usr/local/var/run/httpd/ssl_scache(512000)"
        SSLSessionCacheTimeout  300
        <VirtualHost *:${localSSLPort}>
            ServerName ${hostname}
            SSLEngine on
            SSLCertificateFile "${sslCertFile}"
            SSLCertificateKeyFile "${sslKeyFile}"
            DocumentRoot "${baseDir}"
            <Directory "${baseDir}">
                Order allow,deny
                Allow from all
                Options Indexes FollowSymLinks
                AllowOverride all
                Require all granted
            </Directory>
            <FilesMatch "\.(cgi|shtml|phtml|php)$">
                SSLOptions +StdEnvVars
            </FilesMatch>
        </VirtualHost>`;
    }
};
const serverTypes = {
    apache2: async function secureApache2(confType, options) {
        const {
            baseDir,
            backendDomain,
            hostOS,
            httpdConfPath,
            httpdAssetPath,
            restartCmd
        } = options;

        /* istanbul ignore else */
        if (!confTypes.hasOwnProperty(confType)) {
            throw Error(
                debug.errorMsg(
                    `Unknown host type ${confType}. Can be one of: ${Object.keys(
                        confTypes
                    )}`
                )
            );
        }
        const missingOpts = [
            'baseDir',
            'backendDomain',
            'hostOS',
            'httpdConfPath',
            'httpdAssetPath',
            'restartCmd'
        ].filter(opt => !options.hasOwnProperty(opt));
        if (missingOpts.length > 0) {
            throw Error(
                debug.errorMsg(
                    `apache2 configurator requires the following missing options: ${missingOpts.join(
                        ', '
                    )}`
                )
            );
        }
        const hostname =
            typeof backendDomain === 'string'
                ? new url.URL(backendDomain).hostname
                : backendDomain.hostname;
        debug('getting current apache config');
        const confTxt = await hostOS.readFile(httpdConfPath);
        const newBackendDomain = url.format({
            protocol: 'https',
            hostname,
            port: hostname === 'localhost' ? localSSLPort : ''
        });
        // the apacheconf library streams from a local file and has no API to take a string or buffer directly
        // therefore we put it in a temp file
        const tempFile = path.join(os.tmpdir(), 'apache-temp.conf');
        // TODO: (debt) it's ridiculous to do this, we have to parse apacheconf more
        // robustly instead.
        const elidedConfTxt = confTxt.replace(
            /^\s*Include \/usr\/local\/etc\/httpd\/extra.*?\n/gm,
            ''
        );
        debug(`parsing current apache config saved at ${tempFile}`);
        debug(`apacheconf fails first parse.toString()}. removing includes`);
        await fs.writeFile(tempFile, elidedConfTxt, { encoding: 'utf8' });
        const conf = await apacheconf(tempFile);

        // the VirtualHost for SSL could be declared at root
        const alreadySecure =
            hasSecureVHost(conf, hostname) ||
            // or it could be declared inside an IfModule for ssl_module
            lget(conf, 'IfModule', []).some(
                directive =>
                    directive.$args === 'ssl_module' &&
                    hasSecureVHost(directive, hostname)
            );

        if (alreadySecure) {
            debug('found existing secure vhosts, leaving there');
            return { newBackendDomain };
        }

        const portAlreadyBound =
            conf.Listen &&
            conf.Listen.some(
                port => port.toString() === localSSLPort.toString()
            );

        if (portAlreadyBound) {
            throw Error(
                debug.errorMsg(
                    `Local SSL port ${localSSLPort} already bound in ${httpdConfPath}. Is another Magento backend configured?`
                )
            );
        }
        debug('found no existing secure vhosts, generating new ssl cert');
        const { key, cert } = await SSLCertStore.provide(hostname);
        const sslCertFile = path.resolve(
            httpdAssetPath,
            'certs/pwa-apache-ssl.crt'
        );
        const sslKeyFile = path.resolve(
            httpdAssetPath,
            'private/pwa-apache-ssl.key'
        );
        const sslConf = confTypes[confType]({
            baseDir,
            hostname,
            sslKeyFile,
            sslCertFile
        });
        debug('writing key, cert, and backup conf');
        await hostOS.writeFile(
            `${httpdConfPath}.bak-${new Date().getTime()}`,
            confTxt
        );
        await hostOS.writeFile(sslKeyFile, key);
        await hostOS.writeFile(sslCertFile, cert);
        // be sure this is done before overwriting config...
        debug('writing new conf', confTxt, sslConf);
        await hostOS.writeFile(httpdConfPath, confTxt + sslConf);
        debug('restarting httpd');
        const restartCommandsToTry = [
            restartCmd,
            `sudo brew services restart httpd`,
            `sudo brew services restart httpd24`,
            `sudo /usr/local/bin/apachectl -k restart`,
            `sudo service apache2 restart`
        ];
        await hostOS.exec(restartCommandsToTry.join(' || '));
        return { newBackendDomain };
    }
};

module.exports = class SSLConfigurator {
    static async provide(confType, serverType, conf) {
        if (!serverTypes.hasOwnProperty(serverType)) {
            throw Error(
                debug.errorMsg(
                    `Cannot configure SSL. Unknown HTTP server type ${serverType}.`
                )
            );
        } else {
            return serverTypes[serverType](confType, conf);
        }
    }
};
