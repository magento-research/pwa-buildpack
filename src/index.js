const babelPluginMagentoLayout = require('./babel-plugin-magento-layout');
const WebpackMagentoRootComponentsChunksPlugin = require('./WebpackMagentoRootComponentsChunksPlugin');
const getMagentoEnv = require('./get-magento-env');

module.exports = {
    babelPluginMagentoLayout,
    WebpackMagentoRootComponentsChunksPlugin,
    getMagentoEnv
};
