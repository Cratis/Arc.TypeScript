---
title: Capability reference
description: Which Arc capabilities Arc for TypeScript supports, which are experimental or not implemented, and where its behavior deliberately differs from Arc on .NET.
---

Use this page to check whether an Arc capability exists in Arc for TypeScript before you design around it. Each row gives the TypeScript status and the behavior that matters when you compare it with Arc on .NET, the reference implementation. What Arc on .NET and Arc for Kotlin and Java provide is in the [Arc capability matrix](/arc/capabilities/); the wire behavior is in the [Arc HTTP contract](/arc/http-contract/).

:::caution[No full parity, nothing published]
Arc for TypeScript does not have full parity with Arc on .NET, and no package is published to npm. Package names and APIs can still change.
:::

## Status key

| Status | Meaning |
| --- | --- |
| Supported | Implemented in this repository and covered by its passing specs. Supported describes TypeScript behavior. It is not a parity claim. |
| Experimental | Implemented but checked only against substitutes. Do not use it as a supported integration. |
| Not implemented | Not available in this repository. |
| Open | Whether or how Arc for TypeScript supports it is not decided. |
| Not applicable | Belongs to another platform's host or toolchain. |

## Commands

| Capability | Status | Notes |
| --- | --- | --- |
| Command definitions | Supported | `defineCommand` with a Zod schema, registered explicitly with `ArcServer`. Types are erased at runtime, so the schema is the runtime contract. |
| Discovery of model-bound `[Command]` types | Not implemented | Every definition is passed to `ArcServer` explicitly. |
| Asynchronous handlers | Supported | Every callback can return a value or a promise. |
| Validate without executing | Supported | `POST <route>/validate` runs authorization and validation only. A command named `Validate`, or with a path that ends in `/validate`, executes on its own route. |
| Provided values | Supported | `provide` runs after validation and can short-circuit with `rejected(...)` or `denied(...)`. |
| Control outcomes | Supported | Only values created by `response`, `rejected`, and `denied` are outcomes; `isOutcome` recognizes them. Application data with a `kind` property is ordinary data. |
| Execution scopes | Supported | Scopes complete once in reverse order, including a scope whose `begin` threw. A failed completion removes the response. |
| Several and alternative return values | Open | TypeScript has no runtime tuple or union type, so this needs its own design. |
| Command operations and effects | Not implemented | No preflight, compensation, or indeterminate-outcome handling. |
| Command keys and read models in handlers | Not implemented | |
| Calling the pipelines from code | Supported | `executeCommand` and `performQuery`, described in [Call Arc from code](../guides/direct-calls.md). |
| Controller-based commands and queries | Not applicable | ASP.NET Core MVC only. |

## Queries

| Capability | Status | Notes |
| --- | --- | --- |
| Query definitions | Supported | `defineQuery` with a Zod schema and a `perform` callback. |
| Model-bound `[ReadModel]` queries | Not implemented | |
| GET and HTTP `QUERY` | Supported | `QUERY` answers with `Cache-Control: no-store` and can be turned off with `enableQueryMethod: false`. |
| Argument binding | Supported | Case-insensitive names, number and boolean conversion for GET, and repeated GET keys for declared array arguments. |
| Paging and sorting | Supported | Arrays are sorted and paged in memory. A data source that pages itself returns `queryPage(items, totalItems)`. GET requires `pageSize` of at least 1; `QUERY` treats `pageSize: 0` as unpaged. |
| Query filters | Supported | Authorization runs before validation, as for commands. |
| Services and dependency injection | Not implemented | There is no container. Definitions reach services through ordinary module scope. |
| Renderers and read-model interceptors | Not implemented | |

## Observable queries

| Capability | Status | Notes |
| --- | --- | --- |
| Observable queries, HTTP snapshots, SSE, and WebSocket | Not implemented | The TypeScript source type is not decided. |
| Multiplexed hubs, subscription revisions, and transfer modes | Not implemented | |
| Emission guards | Not implemented | |
| Query health endpoint | Not implemented | |

## Validation

| Capability | Status | Notes |
| --- | --- | --- |
| Command and query validators | Supported | `validate` and `filters` return validation results. |
| Validation result shape | Supported | `severity` 0–3, `message`, `members`, `reason`, optional `reasonDetail` and `state`. |
| Malformed requests | Supported | 400 with reason `malformedRequest` and no parser detail. |
| Failing validators | Supported | A validator that throws produces 400 with reason `validatorFailed` and no exception text. For HTTP requests, the original error goes to the configured logger. |
| [Severity filtering](/arc/backend/csharp/commands/validation-severity-filtering/) | Supported, with a deliberate difference | See [Deliberate differences](#deliberate-differences). |
| Concept validators | Not implemented | |
| Validation rules shared with the client | Not implemented | Depends on proxy generation. |

## Security, identity, tenancy, and correlation

| Capability | Status | Notes |
| --- | --- | --- |
| Declared authorization | Supported | No declaration allows everyone. `authenticated` and `roles` restrict. A declaration that combines `anonymous: true` with `authenticated` or `roles` makes the `ArcServer` constructor throw. |
| Per-request authorization | Supported | `authorize(input, context)` runs after the schema. Allowed severity never affects it. |
| Named policies and authentication schemes | Not implemented | |
| Authentication handlers | Supported | An ordered chain; the first handler that recognizes the request decides, and a failure is terminal with 401. |
| Principal from the host framework's authentication | Not implemented | Adapters pass only what Arc's handlers return. |
| [Identity details](/arc/backend/csharp/identity/) | Not implemented | Only `/.cratis/identity-details/schema` exists, and it returns the configured schema object. `/.cratis/me` and the `.cratis-identity` cookie do not exist. |
| Development users and tenants | Not implemented | |
| Microsoft identity platform headers | Not implemented | |
| [Tenant resolution](/arc/backend/csharp/tenancy/resolvers/) | Supported | A header by default, or a configured `resolveTenant` whose result is final. Other built-in resolvers are not implemented. Arc does not check tenant membership. |
| Correlation IDs | Supported | A valid, non-zero UUID in `X-Correlation-ID` is reused; anything else is replaced. |
| Exception redaction | Supported | Outside development, HTTP results carry a generic message and no stack trace. Direct calls are not redacted. |

## Proxies, introspection, and tooling

| Capability | Status | Notes |
| --- | --- | --- |
| TypeScript proxy generation | Not implemented | |
| Introspection endpoints | Supported | Anonymous `/.cratis/commands` and `/.cratis/queries`, with the JSON Schema of each input. |
| OpenAPI | Supported | `/openapi.json` is an OpenAPI 3.1 document with input schemas. It does not describe result schemas. |
| Concepts and derived types on the wire | Not implemented | |
| Build-time diagnostics | Not implemented | |
| Screenplay generation | Not applicable | .NET only. |

## Persistence and Chronicle

| Capability | Status | Notes |
| --- | --- | --- |
| [MongoDB](../guides/mongodb.md) | Supported, read helper only | `@cratis/arc.server.mongodb` reads a tenant database through a trusted filter, with count-then-page and a page size cap. Specs run against substitutes and a live MongoDB 7 replica set. No writes, change streams, observable queries, concept serialization, or full parity with Arc's .NET MongoDB support. |
| Relational databases | Not implemented | No SQL integration. |
| [Chronicle](../guides/chronicle.md) | Experimental | A private package that appends events returned from a command. The published Chronicle TypeScript SDK does not load in Node.js today, and nothing has run against a Chronicle kernel. |
| Transactions and units of work | Not implemented | Neither integration opens a transaction. |

## Testing

| Capability | Status | Notes |
| --- | --- | --- |
| Command, query, and observable query scenarios | Not implemented | Use `executeCommand`, `performQuery`, or `handle` in your own specs. |

## Hosting

| Capability | Status | Notes |
| --- | --- | --- |
| Express 5, Fastify 5, and Hono 4 adapters | Supported | Their differences are listed in [Host Arc in Express, Fastify, or Hono](../guides/host-integration.md#adapter-differences-and-limitations). |
| Cancellation on client disconnect | Supported for Express and Fastify | Hono passes the signal of the request it received. |
| Unsupported methods | Supported | 405 with an `Allow` header for methods that reach Arc. Fastify routes only a fixed list of methods to Arc. |
| Request body limit | Supported | `maxBodyBytes`, 1 MiB by default. Connection, rate, and subscription limits are not implemented. |
| Standalone host, static files, and SPA fallback | Not implemented | The host frameworks can serve static files themselves. |
| Tracing and metrics | Not implemented | |

## Deliberate differences

- **Severity 3 over HTTP.** On a command, `X-Allowed-Severity` accepts `0`, `1`, and `2`. A request that sends `3` is treated as `2` (Warning), so error-severity results still block with 400 and the handler does not run. Arc on .NET 22.22.0 accepts `3` and runs the command. Queries ignore the header. A trusted caller of `executeCommand` can still pass `Severity.Error` in its context.
- **Anonymous caller on a protected operation.** When authentication handlers are configured, Arc for TypeScript answers 401. Arc on .NET answers 403.
- **Message texts.** Malformed requests say `Malformed request`, and redacted exceptions say `An unexpected error occurred`. Arc on .NET uses different texts for both.

## How parity is checked

A paired suite (`yarn test:conformance`) sends the same 33 checks to a .NET host built on the published `Cratis.Arc` 22.22.0 package and to Arc for TypeScript mounted in Express. It covers command execution, validation-only requests, authorization before validation, business-rule and malformed-input rejection, GET and `QUERY` binding, paging, sorting, exception redaction, unsupported methods, and correlation IDs, and it pins the differences above. It also pins two observed differences that are not choices of Arc for TypeScript: the .NET host does not apply `sortBy` on GET, while the structured `QUERY` request sorts identically on both; and Express answers an unknown path with its own HTML 404 without an Arc correlation header. It is a bounded check of those routes, not a claim of full parity.
