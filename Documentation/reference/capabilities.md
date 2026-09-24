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
| Scoped services and explicit dependencies | Supported | Services are registered explicitly against a `serviceToken` as `singleton`, per-execution `scoped`, or `transient`, and definitions declare `handlerDependencies` and `validatorDependencies`. Each direct or HTTP pipeline owns a scope and disposes the services it created there, including after a failure. Singletons belong to the registry and are disposed by `server.dispose()`, or by you when you pass your own `ServiceRegistry`. A singleton factory runs in a registry-owned context that carries only a lifetime `signal`, not in a request context. Singleton cycles across nested executions are rejected, and a detached nested failure joins registry shutdown after its last living ancestor completes. Scope closure is joinable, and shutdown drains admitted work and captured closing scopes before disposing singletons. A successful result from admitted work that finishes during ordinary shutdown draining stays successful. A singleton factory failure poisons the registry and clears successful data from results that are not yet published; so does a failure of the execution itself, such as a failed disposal. No auto-discovery or application container integration. See [Compose services and test pipelines](../guides/services-and-testing.md). |
| Renderers and read-model interceptors | Not implemented | |

## Observable queries

| Capability | Status | Notes |
| --- | --- | --- |
| Observable definitions and HTTP snapshots | Supported, bounded | `defineObservableQuery` accepts async iterables, structural subscribables and `CurrentValueSubject`. Each subscription uses the query authorization and validation pipeline and owns a service scope. Current value answers 200; pending answers 202; a bounded wait answers 408 on timeout or 500 on completion without data. [Stream a query](../guides/observable-queries.md). |
| Direct SSE and WebSocket | Supported, bounded | The query route streams direct result frames through real Express, Fastify and Hono Node adapters. Real generated installed-client subscriptions receive an initial result and a later update on both transports; unsubscribe releases the server source on all three. WebSocket upgrades require the explicit `mount*WebSockets` bridge on the Node listener. |
| Multiplexed WS and SSE hubs | Supported, bounded | `/.cratis/queries/ws` and authenticated `/.cratis/queries/sse` with POST subscribe/unsubscribe work on all three real adapters and the installed 22.19.1 client. Connected advertises revisions and a configurable idle-only keep-alive (0 disables). Positive safe-integer revisions supersede legacy subscribes, reject stale/duplicate operations, and retain unsubscribe tombstones for two minutes (at most 1024 per connection). Unknown or other-caller SSE controls return the same 404; an unauthorized query sends an `Unauthorized` frame and SSE subscribe answers 401. Anonymous SSE hub controls are unavailable, unlike .NET. |
| Full, delta and legacy transfer | Supported, bounded | `full` sends complete snapshots; `delta` sends an initial full array then change sets of full items without data; absent or unknown mode sends full data plus change sets. Scalar results always stay full. Case-insensitive unique `id` keys identify changes; missing/duplicate IDs use JSON multiset comparison, which does not encode order-only changes. The installed client does not reconstruct delta-only arrays in subscription callbacks (`data: []`); select `full` when full callback data is required. |
| Emission guards | Supported | Register service tokens with `observableEmissionGuards`. Guards run in the subscription scope after rendering with an isolated context identifying the query and first delivery. `Allow` delivers, `Suppress` withholds without advancing the delta baseline, and `DenyAndTerminate` sends a terminal unauthorized result or hub frame. Guard failures deny and are logged. |
| Query health endpoint | Supported, opt-in with a deliberate difference | `enableObservableHealth: true` registers `/.cratis/queries/health` as an observable query. Only an authenticated caller sees its own tenant/principal's hub connections, subscription counts and query groups; direct connections and remote IPs are not included. .NET exposes broader anonymous metadata. |

## Validation

| Capability | Status | Notes |
| --- | --- | --- |
| Command and query validators | Supported | `validate` and `filters` return validation results. |
| Validation result shape | Supported | `severity` 0–3, `message`, `members`, `reason`, optional `reasonDetail` and `state`. |
| Malformed requests | Supported | 400 with reason `malformedRequest` and no parser detail. |
| Failing validators | Supported | A validator that throws produces 400 with reason `validatorFailed` and no exception text. For HTTP requests, the original error goes to the configured logger. |
| [Severity filtering](/arc/backend/csharp/commands/validation-severity-filtering/) | Supported, with a deliberate difference | See [Deliberate differences](#deliberate-differences). |
| Concept validators | Not implemented | |
| Validation rules shared with the client | Not implemented | Generated proxies carry no validation rules; `validate()` asks the server. |

## Security, identity, tenancy, and correlation

| Capability | Status | Notes |
| --- | --- | --- |
| Declared authorization | Supported | No declaration allows everyone. `authenticated` and `roles` restrict. A declaration that combines `anonymous: true` with `authenticated` or `roles` makes the `ArcServer` constructor throw. |
| Per-request authorization | Supported | `authorize(input, context)` runs after the schema. Allowed severity never affects it. |
| Named policies and authentication schemes | Not implemented | |
| Authentication handlers | Supported | An ordered chain; the first handler that recognizes the request decides, and a failure is terminal with 401. |
| Principal from the host framework's authentication | Supported, opt-in | Set `nativePrincipal: true` and supply a host-verified principal through an adapter callback. Mutually exclusive with Arc authentication handlers; no principal is inferred from HTTP headers. Hono requires an explicit trusted callback. |
| [Identity details](/arc/backend/csharp/identity/) | Supported, opt-in | `identityDetails` pairs a Zod schema with a per-request provider. `/.cratis/me` is registered only with this provider (401/403/200); successful responses set a client-readable Base64 display cookie (ASCII-escaped Unicode JSON for `atob` compatibility, encoded header at most 4096 bytes) with `no-store`. The legacy `identityDetailsSchema` remains available without a provider. The cookie is not a credential. |
| Development users and tenants | Supported, opt-in | Both discovery routes return `[]` by default. Providers require `development: true`, are anonymous, bounded to 100 entries and 32 KiB, and retain duplicates; do not expose real credentials or memberships. |
| Microsoft identity platform headers | Not implemented | Unverified headers never authenticate a principal. |
| [Tenant resolution](/arc/backend/csharp/tenancy/resolvers/) | Supported, bounded | Legacy header and authoritative `resolveTenant` remain unchanged. Opt-in ordered header, query, claim, fixed, and strict subdomain sources support `required` and mandatory own-claim membership checks when configured for a selected tenant. Subdomain requires a configured ASCII base domain and explicit host-verified authority, never raw Host/forwarded headers. No development resolver or automatic membership lookup. |
| Correlation IDs | Supported | A valid, non-zero UUID in `X-Correlation-ID` is reused; anything else is replaced. |
| Exception redaction | Supported | Outside development, HTTP results carry a generic message and no stack trace. Direct calls are not redacted. |

## Proxies, introspection, and tooling

| Capability | Status | Notes |
| --- | --- | --- |
| TypeScript proxy generation | Supported, bounded source preview | `exportClientManifest` in the core writes a version 1 JSON manifest from registered operations that declare an explicit `clientOutput` shape. `@cratis/arc.server.codegen` renders it with `renderClientManifest` or writes it with `generateClient`; its CLI reads only that JSON and takes an absolute manifest path and an existing absolute output directory. Flat DTOs, basic and optional inputs, command responses, and DTO or array queries are tested with `@cratis/arc` 22.19.1, `@cratis/fundamentals` 7.19.3, and `rxjs` 7.8.2 against live Express, Fastify, and Hono hosts. Consumers must compile in strict `Bundler` mode; `skipLibCheck: false` works, and `NodeNext` consumer compilation is not supported because of the published declarations. Set the server origin on each proxy with `setOrigin`. Observable definitions with explicit `clientOutput` generate `ObservableQueryFor` proxies with their exact query name; generated proxies are compiled against the installed client and exercised over direct SSE on all three adapters. Not generated: Zod defaults, transforms, and refinements, nullable command fields, scalar query results, nested DTOs, and React hooks. No automatic discovery, no full type graph, no npm publication, and not parity with Arc's .NET proxy generator. See [Generate command and query clients](../guides/generate-clients.md). |
| Introspection endpoints | Supported | Anonymous `/.cratis/commands` and `/.cratis/queries`, with the JSON Schema of each input. |
| OpenAPI | Supported | `/openapi.json` is an OpenAPI 3.1 document with input schemas. It does not describe result schemas. Its `info.version` is a fixed `0.1.0` for the application API document, not the package version. |
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
| Command and query pipeline testing | Supported | `ArcScenario` from `@cratis/arc.server/testing` runs the actual direct or HTTP pipeline. `shouldHaveRuleFailure` rejects dependency-only failures. `ArcScenario.observeQuery` opens the real observable query pipeline and returns a session whose `results()` stream can be collected and canceled by a spec. |

## Hosting

| Capability | Status | Notes |
| --- | --- | --- |
| Express 5, Fastify 5, and Hono 4 adapters | Supported | Their differences and TLS/native principal trust boundary are listed in [Host Arc in Express, Fastify, or Hono](../guides/host-integration.md#adapter-differences-and-limitations). |
| Cancellation on client disconnect | Supported for Express and Fastify | Hono passes the signal of the request it received. |
| Unsupported methods | Supported | 405 with an `Allow` header for methods that reach Arc. Fastify routes only a fixed list of methods to Arc. |
| Request body limit | Supported | `maxBodyBytes`, 1 MiB by default. Subscribable emission queues cap at 64 pending snapshots. Retained subscriptions cap at 128 globally (configurable to 1024), with a default of 16 per authenticated principal and tenant and eight for the anonymous tenant group. Current HTTP snapshots use a separate bounded opening budget; an exhausted subscription budget answers 503 with `Retry-After: 1`. Hubs cap at 64 connections globally (eight per authenticated caller and tenant, four per anonymous tenant group) and 32 subscriptions per connection, with outbound queues bounded to 64 frames. No request-rate limit. |
| Standalone host, static files, and SPA fallback | Not implemented | The host frameworks can serve static files themselves. |
| Tracing and metrics | Not implemented | |

## Deliberate differences

- **Severity 3 over HTTP.** On a command, `X-Allowed-Severity` accepts `0`, `1`, and `2`. A request that sends `3` is treated as `2` (Warning), so error-severity results still block with 400 and the handler does not run. Arc on .NET 22.22.0 accepts `3` and runs the command. Queries ignore the header. A trusted caller of `executeCommand` can still pass `Severity.Error` in its context.
- **Anonymous caller on a protected operation.** When authentication handlers are configured, Arc for TypeScript answers 401. Arc on .NET answers 403.
- **Message texts.** Malformed requests say `Malformed request`, and redacted exceptions say `An unexpected error occurred`. Arc on .NET uses different texts for both.

## How parity is checked

A paired suite (`yarn test:conformance`) sends the same 33 checks to a .NET host built on the published `Cratis.Arc` 22.22.0 package and to Arc for TypeScript mounted in Express. It covers command execution, validation-only requests, authorization before validation, business-rule and malformed-input rejection, GET and `QUERY` binding, paging, sorting, exception redaction, unsupported methods, and correlation IDs, and it pins the differences above. It also pins two observed differences that are not choices of Arc for TypeScript: the .NET host does not apply `sortBy` on GET, while the structured `QUERY` request sorts identically on both; and Express answers an unknown path with its own HTML 404 without an Arc correlation header. It is a bounded check of those routes, not a claim of full parity.
