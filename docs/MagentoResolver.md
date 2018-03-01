## MagentoResolver

Adapter for configuring Webpack to resolve assets according to Magento PWA conventions.

### Usage

In `webpack.config.js`:

```js
const buildpack = require('@magento/pwa-buildpack');
const MagentoResolver = buildpack.Webpack.MagentoResolver;

module.exports = async env => {
    const config {
        /* webpack entry, output, rules, etc */


        resolve: await MagentoResolver.configure({
            paths: {
                root: __dirname
            }
        })

    };

    return config;
}
```


 - ⚠️ `MagentoResolver.configure()` is async and returns a Promise, so a Webpack
   config that uses it must use the [Exporting a Promise configuration type](https://webpack.js.org/configuration/configuration-types/#exporting-a-promise).
   The newer `async/await` syntax looks cleaner than using Promises directly.

### Purpose

Generates a configuration for use in the [`resolve` property of Webpack config](https://webpack.js.org/configuration/resolve/).
Describes how to traverse the filesystem structure for assets required in source
files.

Currently, `MagentoResolver` does very little, but it's likely that the Magento
development environment will require custom resolution rules in the future; this
utility sets the precedent of the API for delivering those rules.

### API

`MagentoResolver` has only one method: `.configure(options)`. It returns a Promise
for an object that can be assigned to the `resolve` property in Webpack config
objects.

#### `MagentoResolver.configure(options: ResolverOptions): Promise<resolve>`

#### `options`

 - `paths: object`: **Required.** Local absolute paths to theme folders.
     - `root`: Absolute path to the root directory of the theme.
