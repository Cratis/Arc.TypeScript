---
title: The Cratis package
description: Register Arc and the Chronicle integration with one call from @cratis/cratis, the TypeScript counterpart of the .NET Cratis package.
---

An application that uses Arc and Chronicle together imports from `@cratis/arc.core` and `@cratis/arc.chronicle`, and calls `withChronicle` on every builder. `@cratis/cratis` composes the two: one import, one builder call. It is the TypeScript counterpart of the .NET `Cratis` package.

:::note[Install]
Run `npm install @cratis/cratis`. It depends on `@cratis/arc.core`, `@cratis/arc.chronicle`, and `@cratis/arc.testing`, which npm installs with it. The Chronicle integration is experimental and its guarantees are bounded; see the [capability reference](../reference/capabilities.md#persistence-and-chronicle).
:::

## Create the builder

```typescript title="main.ts"
import { CratisApplication } from '@cratis/cratis';
import { metadata } from './Features/generatedMetadata.js';

const builder = CratisApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run();
```

`CratisApplication.createBuilder(options, chronicle)` creates an Arc builder with `options`, the same [configuration options](../configuration/index.md) `ArcApplication.createBuilder` takes, and registers Chronicle with `chronicle`. Both default to empty, so the example above reads the event store and connection from `Cratis:Chronicle` in `appsettings.json` or the environment. [Registration options](registration-options.md) lists the Chronicle options and the configuration keys.

On a builder you created yourself, `builder.addCratis({ eventStore, connectionString })` does the same after you import `@cratis/cratis`.

## What it exports

| Import | Re-exports |
| --- | --- |
| `@cratis/cratis` | `@cratis/arc.core` and `@cratis/arc.chronicle`, plus `CratisApplication` |
| `@cratis/cratis/testing` | `@cratis/arc.testing` and `@cratis/arc.chronicle/testing` |

## What it does not add

It does not install an authentication handler. If your routes need authentication, pass one in `CratisApplication.createBuilder({ authentication: [...] })`, as you would to `ArcApplication.createBuilder`; see [Authentication](../core/authentication.md). Public routes need no handler.

## Related

- [Add event sourcing](add-event-sourcing.md)
- [Registration options](registration-options.md)
- [Packages](../reference/packages.md)
