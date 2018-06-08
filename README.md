# pwa-buildpack

[![CircleCI](https://circleci.com/gh/magento-research/pwa-buildpack.svg?style=svg&circle-token=a34631f6c22f0bdd341f9773895f9441584d2e6a)](https://circleci.com/gh/magento-research/pwa-buildpack)

PWA Buildpack is a build and development tool and library for Magento Progressive Web Apps. 

Historically, a developer working on a Magento theme had to set up their own:

* Local Magento 2 store, hosted or virtualized
* System hosts file to resolve local site
* Theme skeleton and configuration files
* Frontend build process tools
* Required filesystem links and structure

In contrast, modern frontend development outside Magento often happens in a service-oriented architecture, where the "frontend" and "backend" are separate, encapsulated, and set up independently alongside one another.
Developers expect to begin working quickly on the frontend prototype, without spending much time or energy setting up their own services layer.

The mission of pwa-buildpack is to be the zero-configuration, easy-setup development and deployment tool for Magento-supported Progressive Web Apps.

Use the this project to set up and configure your local environment for PWA development.

See [PWA Buildpack documentation]

## Getting Started

Follow the project [Setup] tutorial to get a local development environment set up.

## Contributing

The `pwa-buildpack` repository is an open source project that welcomes contributors of all skill levels.

If you want to contribute to this project, please review the [contribution guidelines] and follow our [code of conduct].

## License

This project is under the OSL-3.0 license - see the [LICENSE.txt] file for details.

[PWA Buildpack documentation]: https://magento-research.github.io/pwa-devdocs/pwa-buildpack/
[Setup]: https://magento-research.github.io/pwa-devdocs/pwa-buildpack/project-setup/
[contribution guidelines]: .github/CONTRIBUTING.md
[code of conduct]: .github/CODE_OF_CONDUCT.md
[LICENSE.txt]: LICENSE.txt

## Afterword

Plenty of generous people in the Magento community have created setup scripts, Vagrant and Docker configurations, and other tools for setting up a Magento 2 dev environment automatically.
`pwa-buildpack` is a peer, not a replacement, for these tools.

This project is an element of Magento PWA Studio, and it will always track the best practices for frontend development and PWA development in particular.
There is room for other tools serving other use cases.
