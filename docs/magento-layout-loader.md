# magento-layout-loader

_This is a very early implementation, and the API should be considered
unstable._

The `magento-layout-loader` is a [webpack
loader](https://webpack.js.org/concepts/loaders/) that implements the Magento
PWA Studio layout language. It gives Magento modules/extensions the ability to
inject or remove content blocks in a layout without modifying theme source
files.

## Terminology

* **Container**: An HTML element that contains 0 or more ContainerChild
  components. It acts as the target for the magento-loader-layout operations.
* **ContainerChild**: Component exposed by
  [Peregrine](https://github.com/magento-research/peregrine/). Responsible for
  rendering content
* **Operation**: An action that can be taken on a `Container` or
  `ContainerChild`. Examples include `removeContainer`, `insertAfter`, etc.

## `Container` Details

A Container can be created by adding a `data-mid` prop to any DOM element
(`div`/`span`/etc) in any React component. There are a limited number of
restrictions with Containers to be aware of:

* The `data-mid` prop _must_ be a literal string value - it cannot be a dynamic
  value, or a variable reference
* The direct descendants of a Container can only be a single component type -
  `ContainerChild` from
  [Peregrine](https://github.com/magento-research/peregrine/)
* A Container _must_ be a DOM element - it cannot be a Composite Component

## `ContainerChild` Details

Import the ContainerChild from @magento/peregrine to use it in your
extension/module:

```js
import { ContainerChild } from '@magento/peregrine';
```

See the
[`ContainerChild`](https://github.com/magento-research/peregrine/blob/master/docs/ContainerChild.md)
documentation for further details on usage.

## Supported Operations/Configurations

### Fields

| Config Name       |                                       Description                                        |
| ----------------- | :--------------------------------------------------------------------------------------: |
| `operation`       |                         One of the supported types of operations                         |
| `targetContainer` |                    The `data-mid` value of the `Container` to target                     |
| `targetChild`     |        The `id` value of the `ContainerChild` to target within `targetContainer`         |
| `componentPath`   | An absolute path pointing to a file containing a React component as the `default` export |

### Operations

#### removeContainer

```js
{
    "operation": "removeContainer",
    "targetContainer": "any.container.id"
}
```

#### removeChild

```js
{
    "operation": "removeChild",
    "targetContainer": "any.container.id",
    "targetChild": "container.child.id"
}
```

#### insertBefore

```js
{
    "operation": "insertBefore",
    "targetContainer": "any.container.id",
    "targetChild": "container.child.id",
    "componentPath": "/Absolute/path/to/a/component.js"
}
```

#### insertAfter

```js
{
    "operation": "insertAfter",
    "targetContainer": "any.container.id",
    "targetChild": "container.child.id",
    "componentPath": "/Absolute/path/to/a/component.js"
}
```

## FAQ

TODO: Commonly asked questions
