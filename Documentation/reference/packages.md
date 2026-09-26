---
title: Packages
description: The packages this repository builds, what each exports, their peer dependencies and Node.js requirements, and how they relate to the published @cratis/arc client.
---

Every package in this repository is at version 0.37.0, the version of the source preview. **None is published to npm.** They ship ES modules only. Clone this repository, run `yarn install` and `yarn build`, and then use the packages in one of two ways:

- **Inside the clone.** Put your application in a folder under `Samples/`, which the root `workspaces` list includes, and reference the packages with the `workspace:^` protocol, as [`Samples/Tasks/package.json`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/package.json) does. `workspace:^` resolves only inside this repository's Yarn workspace.
- **In your own project.** Pack each package you need with `yarn workspace <package> pack --out <file>` and install the tarballs with npm. Use `yarn pack`: it rewrites `workspace:^` dependencies to version ranges, and `npm pack` does not. `yarn check:consumers` installs packed packages this way to check NodeNext and Bundler consumers.

[Create an application](../getting-started/create-an-application.md) walks through both paths, from an empty folder to a running command and query.

## Server packages

| Package | Folder | Exports | Peer dependencies |
| --- | --- | --- | --- |
| `@cratis/arc.core` | `Source/Core` | `ArcApplication`, the artifact, field, authorization, and service decorators, validators, `ArcServer`, `define*`, results, authentication, identity, tenancy, introspection, `exportClientManifest`, `runArc`, `createArcNodeHandler`; `@cratis/arc.core/hosting` for WebSocket hosting primitives; Node builder loads `appsettings.json` and `Cratis__...` environment keys | `@cratis/fundamentals` `^7.19.6`, `@opentelemetry/api` `^1.9.0`; depends on `zod` 4 |
| `@cratis/arc.express` | `Source/Express` | `cratisArc` middleware with `.injectWebSocket` | `express` `^5.0.0` |
| `@cratis/arc.fastify` | `Source/Fastify` | `cratisArc` plugin | `fastify` `^5.0.0` |
| `@cratis/arc.hono` | `Source/Hono` | `cratisArc` middleware, `serveCratisArc` Node helper, `createHonoWebSockets` for shared Node helpers | `hono` `^4.0.0`; optional `@hono/node-server` `^1.19.11` |
| `@cratis/arc.testing` | `Source/Testing` | `CommandScenario`, `QueryScenario`, `ObservableQueryScenario`, `ArcScenario`, `given`, `shouldHaveRuleFailure` | |
| `@cratis/arc.mongodb` | `Source/MongoDB` | `withMongoDB`, `mongoCollection`, `MongoCollection`, naming policies, `MongoReadModels` | `@cratis/arc.core`, `@cratis/fundamentals`, `mongodb` `^6.21.0` |
| `@cratis/arc.drizzle` | `Source/Drizzle` | `withDrizzle`, `drizzleReadModel`, `drizzleDatabase`, `DrizzleReadModels`, column codecs | `@cratis/arc.core`, `@cratis/fundamentals`, `drizzle-orm` `^0.45.0` |
| `@cratis/arc.chronicle` | `Source/Chronicle` | Experimental: `withChronicle`, `commandAggregate`, `reactorCommandResultHandler`, `executeCommandsAsSystem`, `eventForEventSourceId`, `eventSourceIdResponse`, `eventsWithConcurrencyScopes`, routing decorators, `notAudited`, `ChronicleReadModels`; `@cratis/arc.chronicle/testing` for `ChronicleCommandScenario` and `ChronicleKernelScenario` | `@cratis/arc.core`, `@cratis/arc.testing`, `@cratis/chronicle` `^6.7.0` (tested with 6.10.0), `@cratis/fundamentals`, `zod` |
| `@cratis/cratis` | `Source/Cratis` | Experimental composition, the counterpart of the C# `Cratis` package: `CratisApplication.createBuilder`, `builder.addCratis`; re-exports Arc, Chronicle and testing (`./testing`); no implicit authentication handler | Arc core, Arc Chronicle, Arc testing, Chronicle SDK, Fundamentals, `zod` |

`@cratis/cratis` is experimental, like the Chronicle integration it composes, and is not published to npm yet. Unlike C# `AddCratis`, the TS composition does not install Microsoft identity automatically: for protected routes, explicitly choose an authentication handler (such as `microsoftIdentityPlatform()`) or your own trusted host principal; public routes need neither. It composes the client, not the event-store engine. See [The Cratis package](../chronicle/cratis-package.md).

## Tooling packages

| Package | Folder | Exports |
| --- | --- | --- |
| `@cratis/arc.proxygenerator` | `Source/Tools/ProxyGenerator` | The `arc-proxygenerator` CLI, `analyzeSource`, `renderSource`, `generateFromSource`, `renderGeneratedMetadata`, and the manifest path's `renderClientManifest` and `generateClient` |
| `@cratis/eslint-plugin-arc-core` | `Source/CodeAnalysis` | ESLint 10 rules and the `recommended` and `recommended-type-checked` presets; peers `eslint` `^10.0.0` and `@typescript-eslint/parser` `^8.70.0` |

## Node.js

The core, adapter, MongoDB, and Drizzle packages need Node.js 22 or later. Building the workspace needs Node.js 22.19 or later, because it installs the Chronicle SDK; Node.js 24 LTS is recommended.

## The client packages

`@cratis/arc`, `@cratis/arc.react`, and `@cratis/arc.react.mvvm` are Arc's existing TypeScript **client** packages, built and published from the [Arc repository](https://github.com/Cratis/Arc). This repository does not replace, rename, or republish them. They are the compatibility target for this server's wire behavior, and generated proxies import them in your frontend. The server packages never depend on them.

## Related

- [Capability reference](capabilities.md)
- [Prepare and publish a TypeScript release](../contributing/releases.md)
