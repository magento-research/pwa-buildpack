const { resolve } = require('path');
const {
    child_process: { exec },
    fs,
    xml2js
} = require('../../../util/promisified');
const semver = require('semver');
const debug = require('../../../util/debug').here(__filename);
const { Mode } = require('../../Environment');
const DevMode = require('../Provisioners/DevMode');
const ProductionMode = require('../Provisioners/ProductionMode');

class PeregrineDev extends DevMode {
    static REQUIRED_PATHS = {
        locale: 'i18n/en_US.csv',
        root: './',
        entry: 'src/index.js',
        output: 'web/js',
        assets: 'web',
        modules: 'node_modules',
        js: 'src',
        css: './',
        viewxml: 'etc/view.xml'
    };
    static REQUIRED_DEPENDENCIES = {
        '@magento/peregrine': '^0.1.1-alpha',
        'babel-runtime': '^6.26.0',
        react: '^16.2.0',
        'react-dom': '^16.2.0',
        'react-redux': '^5.0.6',
        'react-router-dom': '^4.2.2',
        redux: '^3.7.2'
    };
    async nowResolvePaths() {
        const required = PeregrineDev.REQUIRED_PATHS;
        const requiredKeys = Object.keys(required);
        debug(`nowResolvePaths() resolving`, requiredKeys);
        const verifyingPaths = requiredKeys.map(name => {
            const resolved = resolve(this.config.baseDir, required[name]);
            return fs
                .stat(resolved)
                .then(() => resolved)
                .catch(e => {
                    throw Error(
                        debug.errorMsg(
                            `A Peregrine app requires the ${name} path ${
                                required[name]
                            } to be present, but ${resolved} was not. ${
                                e.message
                            }`
                        )
                    );
                });
        });
        return Promise.all(verifyingPaths).then(resolved =>
            resolved.reduce((obj, fullPath, i) => {
                obj[requiredKeys[i]] = fullPath;
                return obj;
            }, {})
        );
    }
    async nowResolveDependencies() {
        await this.readViewConfig();
        const required = PeregrineDev.REQUIRED_DEPENDENCIES;
        const requiredKeys = Object.keys(required);
        let result;
        let validityWarning = '';
        debug(`nowResolveDependencies() trying npm json`);
        try {
            result = await exec('npm ls --depth=1 --json', {
                cwd: this.config.baseDir
            });
        } catch (e) {
            validityWarning += e.stderr;
            result = e.stdout;
        }
        const installedDeps = JSON.parse(result).dependencies;
        const valid = [];
        const invalid = [];
        requiredKeys.forEach(name => {
            if (!installedDeps[name]) {
                invalid.push(name);
                validityWarning += `\nDependency ${name}@${
                    required[name]
                } is missing.`;
            } else if (
                !semver.satisfies(installedDeps[name].version, required[name])
            ) {
                invalid.push(name);
                validityWarning += `\nDependency '${name}' is invalid: ${
                    required[name]
                } expected, version ${installedDeps[name].version} installed.`;
            } else {
                valid.push(name);
            }
        });
        const out = {
            valid,
            invalid
        };
        if (validityWarning) {
            out.validityWarning = validityWarning;
        }
        return out;
    }
    async nowIdentify() {
        const id = await super.nowIdentify();
        return id
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]/g, '-')
            .replace(/^-+/, '');
    }
    async readViewConfig() {
        const xmlTxt = await fs.readFile(this.paths.viewxml);
        const viewXML = await xml2js.parseString(xmlTxt);
        const moduleName = PeregrineDev.MAGENTO_SUPPORT_MODULE_NAME;
        if (!viewXML.view.vars) {
            viewXML.view.vars = [];
        }
        let pwaVars = viewXML.view.vars.find(
            ({ $ }) => $.module === moduleName
        );
        if (!pwaVars) {
            pwaVars = {
                $: {
                    module: moduleName
                },
                var: []
            };
            viewXML.view.vars.push(pwaVars);
        }
        this._viewConfig = viewXML;
        this._viewConfigVars = pwaVars.var;
    }
    async getViewConfigItem(key) {
        if (!this._viewConfig) {
            await this.readViewConfig();
        }
        return this._viewConfigVars.find(({ $ }) => $.name === key);
    }
    async getViewConfigValue(key) {
        const cfgVar = await this.getViewConfigItem(key);
        return cfgVar && cfgVar._;
    }
    async writeViewConfig(updates) {
        if (!this._viewConfig) {
            await this.readViewConfig();
        }
        const vars = this._viewConfigVars;
        await Promise.all(
            Object.entries(updates).map(async ([name, value]) => {
                let item = await this.getViewConfigItem(name);
                if (!item) {
                    item = { $: { name } };
                    vars.push(item);
                }
                item._ = value;
            })
        );
        const newView = new xml2js.Builder().buildObject(this._viewConfig);
        debug('new viewconfig', this._viewConfig, 'newView', newView);
        await fs.writeFile(this.paths.viewxml, newView, 'utf8');
    }
}
class PeregrineProd extends ProductionMode {}
module.exports = {
    [Mode.DEVELOPMENT]: PeregrineDev,
    [Mode.PRODUCTION]: PeregrineProd
};
