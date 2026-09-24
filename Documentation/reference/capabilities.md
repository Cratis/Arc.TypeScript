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
| Command definitions | Supported | `@command()` classes with Fundamentals `@field` declarations compile into the existing Arc pipeline; `defineCommand` with Zod remains the low-level path. |
| Model-bound command discovery | Supported, bounded | `ArcApplicationBuilder.add(...)` accepts an explicit catalog; `discover()` imports exported artifacts from a dedicated file-URL folder, derives namespaces from paths, and rejects conflicting namespaces and mixed JS/TS outputs. No bundler or assembly scanning. |
| Asynchronous handlers | Supported | Every callback can return a value or a promise. |
| Validate without executing | Supported | `POST <route>/validate` runs authorization and validation only. A command named `Validate`, or with a path that ends in `/validate`, executes on its own route. |
| Provided values | Supported | `provide` runs after validation and can short-circuit with `rejected(...)` or `denied(...)`. |
| Control outcomes | Supported | Only values created by `response`, `rejected`, and `denied` are outcomes; `isOutcome` recognizes them. Application data with a `kind` property is ordinary data. |
| Execution scopes | Supported | Scopes complete once in reverse order, including a scope whose `begin` threw. A failed completion removes the response. |
| Several return values | Supported, bounded | `tuple(...)` returns a branded group serialized as an array of response values. No type-directed selection of event versus response, and no automatic conversion of union variants. |
| Command operations and effects | Not implemented | No preflight, compensation, or indeterminate-outcome handling. |
| Command keys and read models in handlers | Not implemented | |
| Calling the pipelines from code | Supported | `executeCommand`, `performQuery`, and `server.execute(instance, context)` for a decorated command, described in [Call Arc from code](../guides/direct-calls.md). |
| Controller-based commands and queries | Not applicable | ASP.NET Core MVC only. |

## Queries

| Capability | Status | Notes |
| --- | --- | --- |
| Query definitions | Supported | `@readModel()` with `@query(...)` static methods compiles into the existing query pipeline; `defineQuery` with Zod remains the low-level path. |
| Model-bound `[ReadModel]` queries | Supported, bounded | Complete ordered `argument(name, Type)` / `service(Token)` descriptors; bare `@query()` infers only class-valued services under legacy emitted metadata. `{ observable: true }` is required for observable methods until generated artifact metadata exists. Query identity includes namespace, read-model name, and method. |
| GET and HTTP `QUERY` | Supported | `QUERY` answers with `Cache-Control: no-store` and can be turned off with `enableQueryMethod: false`. |
| Argument binding | Supported | Case-insensitive names, number and boolean conversion for GET, and repeated GET keys for declared array arguments. |
| Paging and sorting | Supported | Arrays are sorted and paged in memory. A data source that pages itself returns `queryPage(items, totalItems)`. GET requires `pageSize` of at least 1; `QUERY` treats `pageSize: 0` as unpaged. |
| Query filters | Supported | Authorization runs before validation, as for commands. |
| Scoped services and explicit dependencies | Supported | Class constructors and `serviceToken` are tokens. `builder.services.addSingleton/addScoped/addTransient` self-bind classes or accept an implementation/factory; `@injectable(...)`, `static inject`, and lifetime decorators declare class dependencies and discovery lifetimes. `@inject(...)` and `service(...)` declare method dependencies. The build preflights declared artifact graphs; factories with undeclared internal dependencies cannot be preflighted. The existing scope, ownership, and shutdown guarantees still apply to low-level definitions. See [Dependency injection](../guides/dependency-injection.md) and [Compose services and test pipelines](../guides/services-and-testing.md). |
| Renderers and read-model interceptors | Not implemented | |

## Observable queries

| Capability | Status | Notes |
| --- | --- | --- |
| Observable definitions and HTTP snapshots | Supported, bounded | `defineObservableQuery` accepts async iterables, structural subscribables and `CurrentValueSubject.of(value)` / `.pending<T>()`. Each subscription uses the query authorization and validation pipeline and owns a service scope. Current value answers 200; pending answers 202; a bounded wait answers 408 on timeout or 500 on completion without data. [Stream a query](../guides/observable-queries.md). |
| Direct SSE and WebSocket | Supported, bounded | The query route streams direct result frames through real Express, Fastify and Hono Node adapters. Real generated installed-client subscriptions receive an initial result and a later update on both transports; unsubscribe releases the server source on all three. WebSocket upgrades require host-specific registration: a Node listener for Express, a Fastify plugin before HTTP routes (register an existing `@fastify/websocket` plugin before the Arc WebSocket mount to share it), or Hono's Node websocket helper and injection (which can be shared with application routes). Direct subscriptions cancel query opening on disconnect. |
| Multiplexed WS and SSE hubs | Supported, bounded | `/.cratis/queries/ws` and authenticated `/.cratis/queries/sse` with POST subscribe/unsubscribe work on all three real adapters and the installed 22.19.1 client. Connected advertises revisions and a configurable idle-only keep-alive (0 disables). Positive safe-integer revisions supersede legacy subscribes, reject stale/duplicate operations, and retain unsubscribe tombstones for two minutes (at most 1024 per connection). Unknown or other-caller SSE controls return the same 404; an unauthorized query sends an `Unauthorized` frame and SSE subscribe answers 401. Browser EventSource authenticates using the application's session cookie, not an Authorization header or the unsigned `.cratis-identity` display cookie. Anonymous SSE hub controls are unavailable, unlike .NET. |
| Full, delta and legacy transfer | Supported, bounded | `full` sends complete snapshots; `delta` sends an initial full array then change sets of full items without data; absent or unknown mode sends full data plus change sets. Scalar results always stay full. The `id` property name is case-insensitive, while string identity values and primitive types compare exactly; missing/duplicate IDs use JSON set comparison, which does not encode order-only or duplicate-count-only changes. The installed client does not reconstruct delta-only arrays in subscription callbacks (`data: []`); select `full` when full callback data is required. |
| Emission guards | Supported | Register service tokens with `observableEmissionGuards`. Guards run in the subscription scope after rendering with an isolated context identifying the query and first delivery. `Allow` delivers, `Suppress` withholds without advancing the delta baseline, and `DenyAndTerminate` sends a terminal unauthorized result or hub frame. Guard failures deny and are logged. |
| Query health endpoint | Supported, opt-in with a deliberate difference | `enableObservableHealth: true` registers `/.cratis/queries/health` as an observable query. Only an authenticated caller sees its own tenant/principal's hub connections, subscription counts and query groups; direct connections and remote IPs are not included. Other callers' unchanged snapshots are not emitted, and own bursts are coalesced. The built-in health query is not emitted as an application proxy in the client manifest. .NET exposes broader anonymous metadata. |

## Validation

| Capability | Status | Notes |
| --- | --- | --- |
| Command and query validators | Supported, bounded | Model-bound `@validator(Target)` classes extend `CommandValidator<T>` or `QueryValidator<T>` with constructor-authored `ruleFor` rules, discovered or added explicitly. Query validators target an explicit `argumentsModel` matching the query's argument descriptors. Low-level `validate` and `filters` still work. One validator per exact runtime target; scoped constructor dependencies resolve through Arc services. See [Validate model-bound commands and queries](../guides/validation.md). |
| Validation result shape | Supported | `severity` 0–3, `message`, `members`, `reason`, optional `reasonDetail` and `state`. |
| Malformed requests | Supported | 400 with reason `malformedRequest` and no parser detail. |
| Failing validators | Supported | A validator that throws produces 400 with reason `validatorFailed` and no exception text. For HTTP requests, the original error goes to the configured logger. |
| [Severity filtering](/arc/backend/csharp/commands/validation-severity-filtering/) | Supported, with a deliberate difference | See [Deliberate differences](#deliberate-differences). |
| Concept and model validators | Supported, bounded | `ConceptValidator<T>` and `ModelValidator<T>` apply through declared `@field` graph members; arrays keep their collection path, cycles and shared references are visited once. `ignoreConceptRules()` suppresses only the direct member's concept validator. No arbitrary getter reflection or DataAnnotations. |
| Validation rules shared with the client | Server rules only | The server implements the client rule-name vocabulary plus a bounded set of server-only predicates, conditions, severity and state. Rules use internal immutable descriptors, but generated proxies still carry no model-bound rules; `validate()` asks the server. Complex FluentValidation features and exact default-message/regex/Unicode parity are unverified or unavailable. |

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
| TypeScript proxy generation | Supported, bounded source preview | `exportClientManifest` in the core writes a version 1 JSON manifest from registered operations that declare an explicit `clientOutput` shape. `@cratis/arc.proxygenerator` renders it with `renderClientManifest` or writes it with `generateClient`; its CLI reads only that JSON and takes an absolute manifest path and an existing absolute output directory. Flat DTOs, basic and optional inputs, command responses, and DTO or array queries are tested with `@cratis/arc` 22.19.1, `@cratis/fundamentals` 7.19.3, and `rxjs` 7.8.2 against live Express, Fastify, and Hono hosts. Consumers must compile in strict `Bundler` mode; `skipLibCheck: false` works, and `NodeNext` consumer compilation is not supported because of the published declarations. Set the server origin on each proxy with `setOrigin`. Observable definitions with explicit `clientOutput` generate `ObservableQueryFor` proxies with their exact query name; generated proxies are compiled against the installed client and exercised over direct SSE on all three adapters. Not generated: Zod defaults, transforms, and refinements, nullable command fields, scalar query results, nested DTOs, and React hooks. No automatic discovery, no full type graph, no npm publication, and not parity with Arc's .NET proxy generator. See [Generate command and query clients](../guides/generate-clients.md). |
| Introspection endpoints | Supported | Anonymous `/.cratis/commands` and `/.cratis/queries`, with the JSON Schema of each input. |
| OpenAPI | Supported | `/openapi.json` is an OpenAPI 3.1 document with input schemas. It does not describe result schemas. Its `info.version` is a fixed `0.1.0` for the application API document, not the package version. |
| Read-model `key()` annotation | Experimental, no effect | Reserved for future storage integrations; it does not change routing, binding, or persistence today. |
| Concepts and derived types on the wire | Supported, bounded | Model-bound `@field` supports primitives, `Date`, Fundamentals `Guid`/`DateOnly`/`TimeOnly`/`TimeSpan`, `ConceptAs` with `static valueType`, nested decorated classes, arrays and companion optional/nullable/default/enum metadata. One schema drives decoding and introspection/OpenAPI input JSON Schema; model-bound results encode concepts as primitives. Polymorphic derivative conversion is not implemented. The legacy Zod path is unchanged. |
| Build-time diagnostics | Supported, bounded | `add()` rejects undecorated classes; `build()` rejects authorization, route, injection, and query decorators on members with no compiled effect. TypeScript signatures reject many invalid service/argument combinations before build. No Roslyn-style analyzer. |
| Screenplay generation | Not applicable | .NET only. |

## Persistence and Chronicle

| Capability | Status | Notes |
| --- | --- | --- |
| [MongoDB](../guides/mongodb.md) | Supported, read helper only | `@cratis/arc.mongodb` reads a tenant database through a trusted filter, with count-then-page and a page size cap. Specs run against substitutes and a live MongoDB 7 replica set. No writes, change streams, observable queries, concept serialization, or full parity with Arc's .NET MongoDB support. |
| Relational databases | Not implemented | No SQL integration. |
| [Chronicle](../guides/chronicle.md) | Experimental | A private package that appends events returned from a command. The published Chronicle TypeScript SDK does not load in Node.js today, and nothing has run against a Chronicle kernel. |
| Transactions and units of work | Not implemented | Neither integration opens a transaction. |

## Testing

| Capability | Status | Notes |
| --- | --- | --- |
| Command and query pipeline testing | Supported | `ArcScenario` from `@cratis/arc.testing` runs the actual direct or HTTP pipeline. `shouldHaveRuleFailure` rejects dependency-only failures. `ArcScenario.observeQuery` opens the real observable query pipeline and returns a session whose `results()` stream can be collected and canceled by a spec. |

## Hosting

| Capability | Status | Notes |
| --- | --- | --- |
| Express 5, Fastify 5, and Hono 4 adapters | Supported | Mount functions accept either `ArcServer` or a built `ArcApplication`; the host retains listener ownership. WebSocket mounting differs: Express raw upgrades bypass middleware but support an async trusted `native` resolver; Fastify uses `@fastify/websocket` routes and hooks; Hono uses `@hono/node-ws` routes and middleware, with an optional `@hono/node-server` peer for Node hosting. Trusted native `secure`/`authority` supports TLS-terminating proxies; `allowedOrigins` defaults to same-origin or accepts an explicit list/predicate. See [Host Arc](../guides/host-integration.md#mount-observable-websockets-on-nodejs). |
| Cancellation on client disconnect | Supported for Express, Fastify, and Node | Hono passes the signal of the request it received. |
| Unsupported methods | Supported | 405 with an `Allow` header for methods that reach Arc. Fastify routes only a fixed list of methods to Arc. The standalone Node host rejects TRACE and CONNECT with 405. |
| Request and observable resource limits | Supported, configurable | `maxBodyBytes` is 1 MiB by default; SSE control bodies and inbound WS frames are separately capped at 64 KiB (Arc closes oversized WS frames with 1009 even with a shared plugin or helper; configure the shared server's `maxPayload` too to reject them before delivery), outbound frames at 1 MiB. Defaults are 4096 retained subscriptions globally and per authenticated principal or anonymous connection/remote address, 512 hub connections globally and per caller, 256 subscriptions per hub connection, and 256 inbound/outbound queued frames or pending subscribable emissions. Every cap is an `ArcServerOptions` setting. Per-caller defaults equal global caps, so configure lower caps if callers must share capacity fairly. Handshake and hub shutdown have independent 10-second deadlines. Current HTTP snapshots use a separate bounded opening budget. Admission exhaustion answers 503 with `Retry-After: 1`; handshake exhaustion answers HTTP 503 or WS close 1013. No request-rate limit. |
| [Standalone host, static files, and SPA fallback](../guides/standalone-host.md) | Supported, bounded | `@cratis/arc.core` runs an HTTP or HTTPS listener or supplies a request handler. Arc routes precede streamed GET/HEAD public files; opt-in HTML navigation fallback excludes the API prefix, `/.cratis` and file extensions. Path base, cache validators, disconnect cancellation and direct SSE are supported. Custom content-type mappings and a bounded shutdown grace period are available. `runArc` owns direct and hub WebSocket upgrades on its listener; do not also attach a custom Arc upgrade bridge there. It starts listener shutdown before joining WebSockets, and rejects at its deadline if shutdown remains incomplete; callers using `createArcNodeHandler` attach the bridge on their own listener via `@cratis/arc.core/hosting`. No private file authorization, directory listing, multiple static roots, static RequestPath independent of path base, list of default documents, or byte-range responses. |
| Tracing and metrics | Not implemented | |

## Deliberate differences

- **Severity 3 over HTTP.** On a command, `X-Allowed-Severity` accepts `0`, `1`, and `2`. A request that sends `3` is treated as `2` (Warning), so error-severity results still block with 400 and the handler does not run. Arc on .NET 22.22.0 accepts `3` and runs the command. Queries ignore the header. A trusted caller of `executeCommand` can still pass `Severity.Error` in its context.
- **Anonymous caller on a protected operation.** When authentication handlers are configured, Arc for TypeScript answers 401. Arc on .NET answers 403.
- **Message texts.** Malformed requests say `Malformed request`, and redacted exceptions say `An unexpected error occurred`. Arc on .NET uses different texts for both.
- **Preparation and binding.** A model-bound `provide()` passes one preparation value as the first `handle` argument. .NET flattens and matches provided values by assignable type in any handler position. TypeScript's explicit-mode queries require ordered descriptors with named arguments; compiler-generated binding metadata is not available yet.
- **Compiler metadata.** Standard decorators require explicit injection tokens; legacy decorators can infer class-valued dependencies only when the transform emits `design:paramtypes` for the decorated member. Interfaces and erased types require tokens in either mode. Model-bound observable queries require `{ observable: true }` at registration, rather than inferring observable cardinality from a declared .NET return type.
- **Enum fields.** TypeScript enum objects are not `@field` constructors; use a scalar `@field(String)` or `@field(Number)` alongside `@enumeration(Enum)`. Numeric enum reverse mappings are ignored. .NET reflects enum field types directly.
- **Compilation and hosting.** The Tasks sample uses Bundler module resolution because the currently installed Fundamentals 7.19.3 declaration barrel cannot type-check as a NodeNext consumer; the core library keeps NodeNext and uses a local declaration shim. The Node host defaults to loopback instead of exposing a listener on every interface. File discovery imports a dedicated artifacts folder, not the bootstrap folder; moving a folder changes its derived namespace and route.

- **Invalid conventional GUID query argument.** .NET 22.22.0 binds `Guid.Empty` and returns 200; TypeScript rejects the malformed UUID with 400 instead of silently querying the default identity.

## How parity is checked

A paired suite (`yarn test:conformance`) sends the same 42 checks to a .NET host built on the published `Cratis.Arc` 22.22.0 package and to Arc for TypeScript mounted in Express. It covers command execution, validation-only requests, authorization before validation, business-rule and malformed-input rejection, GET and `QUERY` binding, paging, sorting, exception redaction, unsupported methods, correlation IDs, a model-bound command, an overridden query path, and a conventional GUID query route with valid and invalid inputs. It pins the validator's custom state, warning threshold, and differences above. It also pins two observed differences that are not choices of Arc for TypeScript: the .NET host does not apply `sortBy` on GET, while the structured `QUERY` request sorts identically on both; and Express answers an unknown path with its own HTML 404 without an Arc correlation header. It is a bounded check of those routes, not a claim of full parity.
