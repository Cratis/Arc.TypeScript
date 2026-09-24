---
title: Packages
description: The packages this repository builds, what each exports, their peer dependencies and Node.js requirements, and how they relate to the published @cratis/arc client.
---

Every package in this repository is at version 0.15.0, the version of the source preview. **None is published to npm**; reference them from a clone with the `workspace:^` protocol. They ship ES modules only.

## Server packages

| Package | Folder | Exports | Peer dependencies |
| --- | --- | --- | --- |
| `@cratis/arc.core` | `Source/Core` | `ArcApplication`, the artifact, field, authorization, and service decorators, validators, `ArcServer`, `define*`, results, authentication, identity, tenancy, introspection, `exportClientManifest`, `runArc`, `createArcNodeHandler`; `@cratis/arc.core/hosting` for WebSocket hosting primitives | `@cratis/fundamentals` `^7.19.6`, `@opentelemetry/api` `^1.9.0`; depends on `zod` 4 |
| `@cratis/arc.express` | `Source/Express` | `mountExpress`, `mountExpressWebSockets` | `express` `^5.0.0` |
| `@cratis/arc.fastify` | `Source/Fastify` | `mountFastify`, `mountFastifyWebSockets` | `fastify` `^5.0.0` |
| `@cratis/arc.hono` | `Source/Hono` | `mountHono`, `mountHonoWebSockets` | `hono` `^4.0.0`; optional `@hono/node-server` `^1.19.11` |
| `@cratis/arc.testing` | `Source/Testing` | `CommandScenario`, `QueryScenario`, `ObservableQueryScenario`, `ArcScenario`, `given`, `shouldHaveRuleFailure` | |
| `@cratis/arc.mongodb` | `Source/MongoDB` | `addMongoDB`, `mongoCollection`, `MongoCollection`, naming policies, `MongoReadModels` | `@cratis/arc.core`, `@cratis/fundamentals`, `mongodb` `^6.21.0` |
| `@cratis/arc.drizzle` | `Source/Drizzle` | `addDrizzle`, `drizzleReadModel`, `drizzleDatabase`, `DrizzleReadModels`, column codecs | `@cratis/arc.core`, `@cratis/fundamentals`, `drizzle-orm` `^0.45.0` |
| `@cratis/arc.chronicle` | `Source/Chronicle` | Experimental, not private since v0.12.0: `addChronicle`, `eventForEventSourceId`, `eventSourceIdResponse`, `eventsWithConcurrencyScopes`, routing decorators, `notAudited`, `ChronicleReadModels`; `@cratis/arc.chronicle/testing` for `ChronicleCommandScenario` | `@cratis/arc.core`, `@cratis/arc.testing`, `@cratis/chronicle` `^6.5.1`, `@cratis/fundamentals`, `zod` |

## Tooling packages

| Package | Folder | Exports |
| --- | --- | --- |
| `@cratis/arc.proxygenerator` | `Source/Tools/ProxyGenerator` | The `arc-proxygenerator` CLI, `analyzeSource`, `renderSource`, `generateFromSource`, and the manifest path's `renderClientManifest` and `generateClient` |
| `@cratis/eslint-plugin-arc-core` | `Source/CodeAnalysis` | ESLint 10 rules and the `recommended` and `recommended-type-checked` presets; peers `eslint` `^10.0.0` and `@typescript-eslint/parser` `^8.70.0` |

## Node.js

The core, adapter, MongoDB, and Drizzle packages need Node.js 22 or later. Building the workspace needs Node.js 22.19 or later, because it installs the Chronicle SDK; Node.js 24 LTS is recommended.

## The client packages

`@cratis/arc`, `@cratis/arc.react`, and `@cratis/arc.react.mvvm` are Arc's existing TypeScript **client** packages, built and published from the [Arc repository](https://github.com/Cratis/Arc). This repository does not replace, rename, or republish them. They are the compatibility target for this server's wire behavior, and generated proxies import them in your frontend. The server packages never depend on them.

## Related

- [Capability reference](capabilities.md)
- [Preview a TypeScript release](../contributing/releases.md)
