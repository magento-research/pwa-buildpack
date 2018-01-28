const path = require('path');
const { URL } = require('url');
const fetch = require('make-fetch-happen').defaults({
    cache: 'no-store',
    strictSSL: false
});
module.exports = magentoHost => {
    if (!magentoHost) {
        return Promise.reject(
            Error('get-magento-env: No Magento domain specified.')
        );
    }
    return fetch(new URL('webpack-config.json', magentoHost).href).then(res =>
        res.json()
    );
};
