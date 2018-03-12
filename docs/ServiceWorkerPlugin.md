## ServiceWorkerPlugin

Webpack plugin for configuring a ServiceWorker for different PWA development
scenarios.

### Usage

In `webpack.config.js`:

```js
const path = require('path');
const buildpack = require('@magento/pwa-buildpack');
const ServiceWorkerPlugin = buildpack.Webpack.ServiceWorkerPlugin;

module.exports = async env => {
    const config = {
        /* webpack config, i.e. entry, output, etc. */
        plugins: [
            /* other plugins */
            new ServiceWorkerPlugin({
                env: {
                    mode: 'development'
                },

                paths: {
                    output: path.resolve(__dirname, 'web/js'),
                    assets: path.resolve(__dirname, 'web')
                },
                enableServiceWorkerDebugging: true,
                serviceWorkerFileName: 'sw.js',
                runtimeCacheAssetPath: 'https://cdn.url'
            })
        ]
    };

    return config;

};
```

### Purpose

This plugin is a wrapper around the [Google Workbox Webpack Plugin](https://developers.google.com/web/tools/workbox/guides/generate-service-worker/),
which generates a caching ServiceWorker based on assets emitted by Webpack.

In development, ServiceWorkers can cache assets in a way that interferes with
real-time editing and changes. This plugin takes configuration that can switch
between "normal development mode", where ServiceWorker is disabled, to "service
worker debugging mode", where ServiceWorker is enabled and hot-reloading.

### API


#### `new ServiceWorkerPlugin(options: PluginOptions): Plugin`

#### `options`

 - `env: object`: **Required.** An object representing the current environment.
     - `mode: string`: **Required**. Must be `'development'` or `'production'`.
 - `paths: object`: **Required.** Local absolute paths to theme folders.
     - `assets: string`: Directory for public static assets.
 - `enableServiceWorkerDebugging: boolean`: When `true`, the ServiceWorker will
   be active at document root (irrespective of publicPath) and hot reloading.
   When `false`, ServiceWorker will be disabled so that asset hot reloading is
   not interrupted by cache.
 - `serviceWorkerFileName: string`: **Required.** The name of the ServiceWorker
   file this theme creates, e.g. `'sw.js'`.
 - `runtimeCacheAssetPath: string`: **Required.** A path, or remote URL,
   representing the root path of assets which the ServiceWorker should cache at
   runtime as they are requested.
