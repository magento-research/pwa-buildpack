# pwa-buildpack BuildSession

#### 🚄 Get up to speed *fast* in Magento PWA Studio

BuildSession is a set of low-maintenance configuration tools for common Magento PWA development scenarios. Supports automatic configuration and provisioning of:

 - A **Peregrine App** in **development mode** using **Webpack** on a **locally hosted Magento instance**
 - A **Peregrine App** in **development mode** using **Webpack** on a **Magento instance virtualized in Vagrant**
 - A **Peregrine App** in **production mode** using **Webpack** on a **locally hosted Magento instance**
 - A **Peregrine App** in **production mode** using **Webpack** on a **Magento instance virtualized in Vagrant**
 - *[Coming soon]* A **Peregrine App** in **development mode** using **Webpack** on a **Magento instance virtualized in Docker**

BuildSession also includes the basic building blocks to create and combine more scenarios in the future.

## Usage

In your `webpack.config.js`, use the `Frontend` and `Backend` building blocks to create a `BuildSession`:


First, import the BuildSession tools from the `@magento/buildpack` package.

```js

const BuildPack = require('@magento/pwa-buildpack');
const { Backend, Frontend, Environment } = BuildPack.BuildSession;

```

Then, export your [Webpack config factory function](https://webpack.js.org/configuration/configuration-types/#exporting-a-promise). Inside it, use the BuildSession building blocks to support your local scenario.

For instance, if you're working on a [Peregrine](https://github.com/magento-research/peregrine) app, backed by a locally hosted Magento store on an OSX machine, you might do:

```js
module.exports = async ({ mode }) => {

    // an Environment tracks environment variables,
    // process status, and events
    const env = Environment.create(mode);

    if (env.mode === Environment.Mode.DEVELOPMENT) {

        // a Frontend configures your frontend code for build
        const frontend = await Frontend.develop(
            // our chosen scenario is Peregrine
            Frontend.presets.PeregrineApp,
            env,
            {
                baseDir: __dirname,
                backendDomain: 'http://local.magento.store',
                runtimeCacheAssetPath: 'https://cdn.url'
            }
        );

        // a Backend configures your Magento store to support a build scenario
        const backend = await Backend.develop(
            // All operating systems should be supported.
            Backend.presets.OSXLocalHosted,
            env,
            {
                baseDir: '~/projects/magento-pwa-theme/',
                backendDomain: 'http://local.magento.store'
            }
        );

        const session = await BuildPack.BuildSession.start({ env, frontend, backend });

        // the session queries the types and configurations of the Frontend and Backend, and computes properties for Webpack to consume

        return {
            context: session.paths.root,
            entry: {
                client: session.paths.entry
            },
            output: {
                path: session.paths.output,
                publicPath: session.publicPath,
                filename: '[name].js',
                chunkFilename: '[name].js'
            },
            module: {
                rules: [
                    {
                        include: session.paths.js,
                        test: /\.js$/,
                        use: [
                            {
                                loader: 'babel-loader',
                                options: {
                                    cacheDirectory: true
                                }
                            }
                        ]
                    },
                    {
                        include: session.paths.css,
                        test: /\.css$/,
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1,
                                    localIdentName:
                                        '[name]-[local]-[hash:base64:3]',
                                    modules: true
                                }
                            }
                        ]
                    },
                    {
                        test: /\.svg$/,
                        use: [
                            {
                                loader: 'file-loader',
                                options: {}
                            }
                        ]
                    }
                ]
            },
            resolve: await M2Webpack.Resolver.configure(session),
            plugins: [
                new M2Webpack.RootComponentsChunksPlugin(),
                new webpack.NoEmitOnErrorsPlugin(),
                new webpack.EnvironmentPlugin(session.envToVars()),
                new M2Webpack.ServiceWorkerPlugin(session)
            ]
        };
    }
}
```

## Tools

### `Backend`

Backend creates `BackendProvisioners`, which proceed through a sequence of steps to set up your backend to work with PWA Studio. Most Magento stores can be configured the same way, but the BuildSession might need to connect to each one differently. `Backend.presets.OSXLocalHosted` connects directly through local child processes, whereas `Backend.presets.VagrantVMHosted` runs the same commands through a tunnel to the virtual machine.

The commands include:

 - Ensuring that the

### `Frontend`

Frontend creates `FrontendProvisioners`, which procees through a different sequence of steps to set up your frontend to work with PWA Studio. A PeregrineApp has a known structure, but it's based on a more general purpose NPM-driven directory structure, based on `FrontendDevModeProvisioner`. The steps are composable and broadly compatible.

### `BuildSession`

The BuildSession detects the strategies of the supplied Frontend and Backend, and composes together a suitable set of paths, URLs, and configurations to start up a build system.

### `DevServer`

A Dev Server is a temporary virtual server that is mostly a proxy to your local store. It does some transformations to make the experience of hot reloading and Magento data retrieval as seamless as possible, including the provisioning of unique URLs and trusted SSL certificates.
