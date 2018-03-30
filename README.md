# pwa-buildpack

[![CircleCI](https://circleci.com/gh/magento-research/pwa-buildpack.svg?style=svg&circle-token=a34631f6c22f0bdd341f9773895f9441584d2e6a)](https://circleci.com/gh/magento-research/pwa-buildpack)

Build and development tools for Magento Progressive Web Apps

## Quick Setup

### Prerequisites

- NodeJS 8.x
- A local Magento 2 store accessible via filesystem _(A network share works, if your backing store is in a virtual machine or a remote system)_

### I. Create a Theme

Magento Progressive Web Apps are built on top of Magento Themes. Start your PWA
by going through the familiar process of [creating a new theme](http://devdocs.magento.com/guides/v2.2/frontend-dev-guide/themes/theme-create.html).
 There are only a few differences:

- You can put your theme directory **anywhere on your file system**, instead
  of inside the `app/design` folder. Buildpack will create symbolic links to
  the store where necessary.
- Buildpack will autogenerate your `view.xml` file. Instead of creating
  `view.xml` variables directly, this theme will store them in the `package.json` file you are about to create.

### II. Configure Development Setup

A Magento PWA theme should be portable; it ought to work on more than one store
configuration. Configure PWA Studio for your local environment using
**environment variables**. Environment variables are a cross-platform standard
and there are many tools for managing them. One simple one is the Node package
`dotenv`, which reads an ini-formatted file to set the environment.

 1. Install the `dotenv` tool with `npm install dotenv`.

 1. Install `buildpack` with `npm install @magento/pwa-buildpack`.

 1. Create a file in your theme directory called `.env`. Put the following lines in it:

    ```sh
    MAGENTO_BACKEND_DOMAIN=https://localhost.magento:8008
    # change the above to your local Magento store's host (with port)

    MAGENTO_PATH=~/path/to/magento/rootdir
    # change the above to the absolute path to the root directory of your local
    # Magento store

    MAGENTO_BACKEND_PUBLIC_PATH=/pub/static/frontend/<Vendor>/<theme>/en_US
    # change the above to your vendor and theme name
    # the locale must be `en_US` for now

    SERVICE_WORKER_FILE_NAME="sw.js"
    ```

 1. Create a file in your theme directory called `webpack.config.js`.

 1. In the first line of your `webpack.config.js` file, add this:

    ```js
    require('dotenv').config();
    ```

    *If you like, you can prove this is working by adding another line that says
   `console.log(process.env.MAGENTO_HOST)`. Save the file and then run `node
    webpack.config.js`.*

 1. Add the following lines to `webpack.config.js`:

    ```diff
    require('dotenv').config();

    +const webpack = require('webpack');
    +const { BuildSession } = require('@magento/pwa-buildpack');
    ```

 1. Export your Webpack config as an async function. Add the following lines to
    `webpack.config.js`:

    ```diff
    require('dotenv').config();

    const webpack = require('webpack');
    const { BuildSession } = require('@magento/pwa-buildpack');

    +module.exports = async function(cliEnvironment) {
    +
    +};
    ```

    This function will execute when Webpack runs and requests configuration.

 1. Add these lines to create a Buildpack `Environment`:

    ```diff
    module.exports = async function(cliEnvironment) {

    +   const { Environment } = BuildSession;
    +   const env = Environment.create(cliEnvironment.mode);

    };
    ```

    All aspects of the `BuildSession` will use this `Environment` to share
    configuration settings, most importantly development/production switches.

    Webpack passes command-line `--env` flags as an argument to the
    configuration function, so you can use `cliEnvironment` as a starting point
    or an override.

 1. Configure the BuildSession for development mode using an `if` statement.

    ```diff
    module.exports = async function(cliEnvironment) {

        const { Environment } = BuildSession;
        const env = Environment.create(cliEnvironment.mode);
    +
    +   if (env.mode === Enrivonment.Mode.DEVELOPMENT) {
    +
    +   }

    };
    ```

0. When in development mode, you'll use a **Frontend Provisioner** designed for development mode. Add these lines inside the `if` block:
    ```diff
    if (env.mode === Environment.Mode.DEVELOPMENT) {

    +    const frontend = await Frontend.develop(
    +        Frontend.presets.PeregrineApp,
    +        env,
    +        {
    +            baseDir: __dirname,
    +            backendDomain: process.env.MAGENTO_BACKEND_DOMAIN
    +        }
    +    );
    +
    }
    ```

    This creates a Provisioner object called `frontend` that will help to configure your development environment to work on a Peregrine app. This provisioner takes many options, but the two required options are `baseDir` (the root directory of the theme) and `backendDomain` (the network host where the local Magento store is located.)

0. When in development mode, you'll use a **Backend Provisioner** designed to provide the server-side functionality necessary to do smooth, fast theme and UI development. Add these lines inside the `if` block:
    ```diff
    if (env.mode === Environment.Mode.DEVELOPMENT) {

        const frontend = await Frontend.develop(
            Frontend.presets.PeregrineApp,
            env,
            {
                baseDir: __dirname,
                backendDomain: process.env.MAGENTO_BACKEND_DOMAIN
            }
        );

    +    const backend = await Backend.develop(
    +        Backend.presets.OSXLocalHosted,
    +        env,
    +        {
    +            vmName: backendDomain.hostname,
    +            baseDir: process.env.MAGENTO_PATH,
    +            backendDomain
    +        }
    +    );
    }
    ```

In any project managed by NPM, the standard command to run the project is `npm
start`. A Magento PWA theme is no different! Start the development cycle with
`npm start` in your theme directory.

```sh
theme/ $ npm start
```

⚠️ *The first time you run `npm start`, or if you haven't run `npm start` in a
long time, PWA Studio may ask for your password. It needs your password for only
a brief time, in order to set local host and SSL trust settings. It will not
retain any broad permissions on your system.*




## Details

Magento PWAs are based on a general-purpose PWA development framework,
[Peregrine](https://github.com/magento-research/peregrine). These tools connect
a Peregrine app to a Magento backend and a
[Webpack](https://webpack.js.org)-based build environment. The mission of
`pwa-buildpack` is to be the zero-configuration, easy-setup development and deployment tools for Magento-supported Progressive Web Apps.

### Developing Magento Storefronts

Historically, a developer working on a Magento theme had to set up their own:
 - Local Magento 2 store, hosted or virtualized
 - System hosts file to resolve local site
 - Theme skeleton and configuration files
 - Frontend build process tools
 - Required filesystem links and structure

In contrast, modern frontend development outside Magento often happens in a
service-oriented architecture, where the "frontend" and "backend" are separate,
encapsulated, and set up independently alongside one another. Developers expect
to begin working quickly on the frontend prototype, without spending much time
or energy setting up their own services layer.

### Elements

* [`babel-plugin-magento-layout`](docs/babel-plugin-magento-layout.md) --
  Resolves Magento layout directives into compile-time changes to React
  components
* [`MagentoRootComponentsPlugin`](docs/MagentoRootComponentsPlugin.md) --
  Divides static assets into bundled "chunks" based on components registered
  with the Magento PWA `RootComponent` interface
* [`PWADevServer`](docs/PWADevServer.md) -- Configures your system settings and
* [`ServiceWorkerPlugin`](docs/ServiceWorkerPlugin.md) -- Creates
  a ServiceWorker with different settings based on dev scenarios
* [`MagentoResolver`](docs/MagentoResolver.md) -- Configures Webpack to resolve
  modules and assets in Magento PWA themes.

## Afterword

Plenty of generous people in the Magento community have created setup scripts,
Vagrant and Docker configurations, and other tools for setting up a Magento 2
dev environment automatically. `pwa-buildpack` is a peer, not a replacement, for
those tools. This project is an element of Magento PWA Studio, and it will
always track the best practices of frontend development and PWA development
particularly. There is room for other tools serving other use cases.

