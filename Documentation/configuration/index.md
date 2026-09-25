---
title: Configuration
description: Configure Arc through its grouped ArcOptions tree, appsettings.json, environment variables, or code, add integrations through the builder, and see what each host reads.
---

The same application runs on your laptop, in CI, and in production. The route prefix stays put, but the tenant source, the exception detail, and the listener address change between them. You want those differences in configuration, not in `if` statements around your startup code.

Arc reads every setting from one `ArcOptions` object. You can fill it from `appsettings.json`, environment variables, and code, and code always has the last word. The groups follow the same `Cratis:Arc` paths as [Arc on .NET](https://github.com/Cratis/Arc/blob/main/Documentation/backend/csharp/configuration/index.md): `CorrelationId`, `Tenancy`, `GeneratedApis`, `Query`, `Hosting`, and `ExposeExceptionDetails`, so one `appsettings.json` shape serves both. Node-specific transport limits and registration hooks live in those groups or alongside them, as noted below.

## What each entry point reads

Where options come from depends on how you create the application. The host you mount it in does not matter: Express, Fastify, and Hono take an application that is already built. See the [hosting overview](../overview.md) for choosing a host.

| Entry point | Reads `appsettings.json` and environment | Typical use |
| --- | --- | --- |
| `ArcApplication.createBuilder()` from `@cratis/arc.core` | Yes, unless you pass `configuration: false` | Node applications, with discovery and the standalone host |
| `CratisApplication.createBuilder()` from `@cratis/cratis` | Yes, including `Cratis:Chronicle` | Arc and the experimental Chronicle integration in one call; see [Add event sourcing](../chronicle/add-event-sourcing.md) |
| `ArcApplication.createBuilder()` from `@cratis/arc.core/fetch` | No, code options only | Fetch API runtimes without a filesystem; see [Fetch API runtimes](../hosts/fetch-runtimes.md) |
| `new ArcServer(options)` | No, code options only | [Low-level definitions](../commands/low-level-definitions.md) and specs |

## Three ways to configure

`ArcApplication.createBuilder()` loads `appsettings.json` from the process working directory, then `appsettings.{Environment}.json` beside it, then `Cratis__...` environment variables, and finally applies code options. The environment comes from `DOTNET_ENVIRONMENT`, `ASPNETCORE_ENVIRONMENT`, or `NODE_ENV`, in that order. Keys are case-insensitive. Code overrides individual nested values rather than replacing the whole group.

```json title="appsettings.json"
{
  "Cratis": {
    "Arc": {
      "CorrelationId": { "HttpHeader": "X-Request-ID" },
      "Tenancy": { "ResolverType": "Fixed", "FixedTenantId": "default" },
      "GeneratedApis": { "RoutePrefix": "api", "EnableQueryHttpMethod": true },
      "Query": { "KeepAliveInterval": "00:00:30" },
      "Hosting": { "ApplicationUrl": "http://127.0.0.1:3000/" },
      "ExposeExceptionDetails": false
    }
  }
}
```

For example, `Cratis__Arc__CorrelationId__HttpHeader=X-Other-ID` overrides the file, while `correlationId: { httpHeader: 'X-Code-ID' }` overrides that environment variable:

```typescript
import { ArcApplication } from '@cratis/arc.core';

const builder = ArcApplication.createBuilder({ correlationId: { httpHeader: 'X-Code-ID' } });
const app = await builder.build();
```

Use `{ configuration: false }` to disable file and environment binding, or `{ configuration: { file: new URL('./appsettings.json', import.meta.url), env: suppliedEnvironment } }` to choose both explicitly. A string path also works. Invalid JSON and invalid known values fail setup; unknown keys within `Cratis:Arc`, `Cratis:Chronicle`, and `Cratis:MongoDB` are reported to `logger` when configured, without including their values. Other configuration sections are ignored. Do not put real connection strings in committed files. Chronicle binds `Cratis:Chronicle:{ConnectionString,EventStore}`, and MongoDB binds `Cratis:MongoDB:{Server,Database}`; clients, handlers, tokens, and other non-serializable values belong in code.

`new ArcServer(options)` uses code options only. It never reads a file or environment overrides. On a Fetch-only runtime, its default for exception exposure is false because there is no Node environment.

## Add features through the builder

Storage and event sourcing are optional packages. Importing one adds its method to the builder, and the method registers everything the integration needs:

| Package | Builder method | Configuration it binds |
| --- | --- | --- |
| `@cratis/arc.mongodb` | `builder.withMongoDB({ ... })`; see [MongoDB](../mongodb/getting-started.md) | `Cratis:MongoDB:{Server,Database}` |
| `@cratis/arc.drizzle` | `builder.withDrizzle({ ... })`; see [SQL with Drizzle](../sql/getting-started.md) | None; pass the database in code |
| `@cratis/arc.chronicle`, experimental | `builder.withChronicle({ ... })`; see [Chronicle](../chronicle/index.md) | `Cratis:Chronicle:{ConnectionString,EventStore}` |

Each package also exports a function form, such as `withMongoDB(builder, options)`, which does the same. Calling a method whose package you did not import fails where you call it, so a missing integration never degrades into a silent no-op. Configuration covers only serializable values. Clients, connection pools, and model classes are passed in code.

## The ArcOptions tree

The paths below are relative to `Cratis:Arc` in configuration and camelCase in TypeScript. `.NET` settings with different value representations are called out explicitly. Unspecified options use the documented defaults.

| Configuration path / TypeScript path | Default | Effect |
| --- | --- | --- |
| `ExposeExceptionDetails` / `exposeExceptionDetails` | `true` only when the effective environment is Development | Include original exception messages and stack traces in serialized HTTP results; otherwise redact them. This does not enable development discovery. |
| `Development` / `development` | `false` | Enable the development user and tenant discovery providers. TypeScript-only; it does not change exception exposure. |
| `CorrelationId:HttpHeader` / `correlationId.httpHeader` | `X-Correlation-ID` | Correlation ID request and response header. |
| `Tenancy:ResolverType` / `tenancy.resolverType` | `header` when `tenancy` is present | Single `header`, `query`, `claim`, `subdomain`, `development`, or `fixed` source. |
| `Tenancy:HttpHeader` / `tenancy.httpHeader` | `x-cratis-tenant-id` | Header source; also the fallback for `resolverType: TenantResolverType.Subdomain` or an ordered `[TenantResolverType.Subdomain, TenantResolverType.Header]` list. |
| `Tenancy:BaseDomain` / `tenancy.baseDomain` | None | Required for the verified subdomain source; exactly one preceding DNS label matches. |
| `Tenancy:QueryParameter` / `tenancy.queryParameter` | `tenantId` | Query-string source. |
| `Tenancy:ClaimType` / `tenancy.claimType` | `tenant_id` | Claim source; only own string claims on authenticated principals count. |
| `Tenancy:FixedTenantId` / `tenancy.fixedTenantId` | `development` | Fixed or development source. The .NET `DevelopmentTenantId` configuration name also binds this value; do not supply both names. |
| `Tenancy:Required` / `tenancy.required` | `false` | Answer 400 when no tenant is selected. TypeScript-only. |
| `Tenancy:MembershipClaim` / `tenancy.membershipClaim` | None | Require the selected tenant in this comma-separated own claim of an authenticated principal, or answer 403. TypeScript-only. |
| `GeneratedApis:RoutePrefix` / `generatedApis.routePrefix` | `api` | Prefix for convention routes. |
| `GeneratedApis:SegmentsToSkipForRoute` / `generatedApis.segmentsToSkipForRoute` | `0` | Leading namespace segments removed from generated routes. |
| `GeneratedApis:IncludeCommandNameInRoute` / `generatedApis.includeCommandNameInRoute` | `true` | Append command names to convention routes. |
| `GeneratedApis:IncludeQueryNameInRoute` / `generatedApis.includeQueryNameInRoute` | `true` | Append query names to convention routes. |
| `GeneratedApis:EnableQueryHttpMethod` / `generatedApis.enableQueryHttpMethod` | `true` | Accept HTTP `QUERY` with JSON arguments as well as GET; false answers 405 with `Allow: GET`. |
| `GeneratedApis:OpenApiVersion` / `generatedApis.openApiVersion` | `0.1.0` | TypeScript-only OpenAPI `info.version`; .NET does not have this ArcOptions key. |
| `Query:KeepAliveInterval` / `query.keepAliveIntervalMs` | `00:00:30` / `30000` ms | Idle hub Ping interval. Files and environment use .NET's `hh:mm:ss` format, converted to milliseconds. In code zero disables keep-alive. |
| `Hosting:ApplicationUrl` / `hosting.applicationUrl` | `http://127.0.0.1:3000/` | Standalone Node HTTP listener URL; an explicit `app.start({ host, port })` or `app.run({ host, port })` overrides its host or port. HTTP adapters and Fetch-only dispatch do not open this listener. |
| `Hosting:MaxBodyBytes` / `hosting.maxBodyBytes` | `1048576` | Maximum JSON command or `QUERY` body in bytes; TypeScript-only hosting limit. |

With no `tenancy` group at all, Arc retains its original behavior: it reads the default tenant header unchanged and does not check membership. When you supply the group, its built-in source validates and normalizes the tenant ID. `tenancy.resolve(request, principal)` is a code-only authoritative resolver; returning `undefined` does not fall back. `tenancy.sources` is a TypeScript-only ordered list of the resolver types above; the first nonempty result wins. Do not combine `sources` and `resolverType`. `tenancy.required` answers 400 when no tenant is selected, and `tenancy.membershipClaim` requires a matching own claim on an authenticated principal or answers 403. See [Tenant resolvers](../tenancy/resolvers.md).

`development: true` enables **only** development user and tenant discovery providers. It does not enable exception details. Conversely, `exposeExceptionDetails: true` does not authorize development providers. On Node, the exception-detail default uses `DOTNET_ENVIRONMENT`, then `ASPNETCORE_ENVIRONMENT`, then `NODE_ENV`; only Development (case-insensitive) exposes details by default. Set it explicitly in code or configuration if your deployment's environment differs. Keep it false on public hosts.

## Observable query limits

All of these TypeScript transport settings belong under `query`; positive numeric values in `Cratis:Arc:Query` accept decimal-integer strings from the environment. The `Query:KeepAliveInterval` key is the shared .NET setting; the remaining limits, guards, Origin policy, and query health are TypeScript extensions.

| TypeScript option | Default | Effect |
| --- | --- | --- |
| `query.allowedOrigins` | Same origin | Exact trusted HTTP(S) Origins or a code-only `(origin, request, native)` predicate; see [WebSockets](../hosts/websockets.md#origin-checks). |
| `query.observableEmissionGuards` | `[]` | Code-only scoped emission policies; see [Emission guards](../queries/observable-query-emission-guards.md). |
| `query.enableObservableHealth` | `false` | Authenticated caller-scoped health query; see [Query health](../queries/query-health.md). |
| `query.maxObservableSubscriptions` / `query.maxObservableSubscriptionsPerCaller` | `4096` / `4096` | Global and per-caller live and opening subscriptions. |
| `query.maxObservableHubConnections` / `query.maxObservableHubConnectionsPerCaller` | `512` / `512` | Global and per-caller hub connections. |
| `query.maxObservableHubSubscriptionsPerConnection` | `256` | Subscriptions on one hub. |
| `query.maxObservableInboundFrames` / `query.maxObservableOutboundFrames` | `256` / `256` | Queued transport frames. |
| `query.maxObservablePendingEmissions` | `256` | Pending snapshots from a structural subscribable. |
| `query.maxObservableInboundFrameBytes` / `query.maxObservableOutboundFrameBytes` | `65536` / `1048576` | Incoming WebSocket frame or SSE control body / outgoing frame sizes. |
| `query.maxObservableTombstones` | `1024` | Retained unsubscribe tombstones per hub connection for two minutes. |
| `query.observableHandshakeTimeoutMs` | `10000` | WebSocket upgrade handshake deadline. |
| `query.observableShutdownTimeoutMs` | `10000` | Hub and direct WebSocket cleanup deadline. |

Per-caller defaults equal global limits: set smaller per-caller budgets for internet-facing hosts. A caller is an authenticated principal in its tenant. An anonymous caller is its peer address in its tenant, and all anonymous callers without a peer address in a tenant share one budget; behind a reverse proxy, that address is the proxy's unless the adapter's native callback supplies a verified client address. See [Per-caller budgets](../queries/observable-query-demultiplexer.md#per-caller-budgets). Exhausted admission answers 503 with `Retry-After: 1`; an exhausted handshake answers HTTP 503 or WebSocket close 1013. The keep-alive interval alone accepts zero. `query.allowedOrigins` accepts a string array in code; the configuration binder does not accept Origin lists or predicates.

## Artifacts and services

These TypeScript-only `ArcOptions` values are code-only; the builder can also register discovered artifacts and matching services directly.

| Option | Default | Effect |
| --- | --- | --- |
| `commands`, `queries`, `observableQueries` | `[]` | Low-level definitions; see [Low-level definitions](../commands/low-level-definitions.md). |
| `services` | Owned empty registry | Registrations or an externally owned `ServiceRegistry`; see [Dependency injection](../dependency-injection.md). |
| `commandResponseValueHandlers`, `commandContextValuesProviders`, `commandKeyResolvers` | `[]` | Ordered scoped response handlers, context providers, and key rules. |
| `readModelForCommandResolvers` | `[]` | Sources for `commandReadModel(...)` parameters. |
| `commandExecutionRunner`, `commandExecutionScopes` | None / `[]` | Validated execution wrapper and per-command scopes. |
| `commandCompensationTimeoutMs` | `30000` | Cooperative budget for [operation](../commands/operations/index.md) compensation. |
| `queryRenderers`, `readModelInterceptors` | `[]` | Ordered scoped read-side extensions. |

## Routes and requests

A body larger than `hosting.maxBodyBytes`, measured by `Content-Length` or while reading, answers 400 `malformedRequest`. Arc also rejects non-UTF-8 JSON, non-finite numbers, nesting beyond 32 levels, and the keys `__proto__`, `prototype`, and `constructor`. Fastify's own `bodyLimit` applies first. Every result carries a correlation ID. Arc reuses a valid, non-zero UUID from `correlationId.httpHeader` in lowercase; otherwise it generates one.

## Security

| Option | Default | Effect |
| --- | --- | --- |
| `authentication`, `authenticationSchemes` | `[]` / `{}` | Ordered and named handlers; see [Authentication](../core/authentication.md). |
| `authorizationPolicies` | `{}` | Named authorization rules, also registered through `addAuthorizationPolicy`. |
| `nativePrincipal` | `false` | Accept a host-verified principal, never a caller-supplied header; see [Native principal](../hosts/native-principal.md). |
| `identityDetails` | None | Registers `/.cratis/me`; see [Identity](../identity/index.md). |
| `developmentUsers`, `developmentTenants` | None | Code-only anonymous discovery providers; require `development: true`. |

## A note on CORS

CORS is not an Arc option. Arc sends no `Access-Control-*` headers, and it answers a preflight `OPTIONS` request to a command or query route with 405 and an `Allow` header. A browser on another origin therefore cannot call Arc until something in front of it handles CORS.

Choose one of these:

- **Serve the frontend from the same origin.** Proxy `/api` and `/.cratis` through your dev server, as the Library sample's Vite configuration does, or serve the built frontend with [static files](../core/static-files.md).
- **Use your web framework's CORS middleware**, mounted before Arc: `cors` for Express, `@fastify/cors` for Fastify, or `hono/cors` for Hono. The middleware answers the preflight and adds the headers to Arc's responses.
- **Handle CORS at your ingress** in front of the standalone host, which has no middleware of its own.

Arc accepts HTTP `QUERY` for queries by default. If cross-origin clients use it, add `QUERY` to the allowed methods; it is not a simple method, so the browser always sends a preflight. A client that only uses GET does not need it.

WebSocket upgrades for observable queries are not covered by CORS. Arc checks their `Origin` against `query.allowedOrigins` itself; see [WebSockets](../hosts/websockets.md#origin-checks).

## Errors and logging

The code-only `logger(error, correlationId)` receives the original error regardless of `exposeExceptionDetails`. A callback failure produces a 500 with `hasExceptions: true`; when exposure is off, HTTP callers receive `['An unexpected error occurred']` and no stack trace. Direct calls are neither redacted nor logged. If the logger throws or rejects, Arc attempts it once and returns a generic redacted 500. A handler failure and a scope cleanup failure arrive together as one `AggregateError`.

## What startup rejects

`build()` and the `ArcServer` constructor fail before serving when:

- names, namespaces, paths, route prefixes, or namespace-skip counts are unsafe;
- `hosting.maxBodyBytes` or a query limit is not a positive safe integer, except that `query.keepAliveIntervalMs` accepts zero;
- `query.allowedOrigins` is not an exact HTTP(S) Origin list or predicate;
- `tenancy` combines `resolverType` and `sources`, uses an invalid source/domain/tenant, or supplies an invalid claim name;
- two operations have case-insensitively duplicate names or colliding routes, including reserved endpoints and `/validate` routes;
- authorization combines anonymous with restricted access, names an unknown policy or scheme, or combines `nativePrincipal` with `authentication`;
- an input schema has case-insensitively duplicate property names or cannot become JSON Schema.

The builder also rejects misplaced decorators, duplicate validator targets, missing service registrations, dependency cycles, and captive lifetimes. A captive lifetime is a singleton that depends on a scoped service. It would keep the first request's instance forever, which in a multi-tenant application means the first tenant's data. Arc checks the declared graph without running any factory, so the check is safe in every environment.

## Low-level definition fields

`defineCommand` and `defineQuery` share `name` (required), `namespace`, `path`, `summary`, `schema` (required), `authorization`, `authorize`, `validate`, `filters`, `handlerDependencies`, `validatorDependencies`, and `clientOutput`. A command also takes `handle` (required), `provide`, and `scopes`. A query takes `perform` (required); an observable query takes `observe` (required). See [Low-level definitions](../commands/low-level-definitions.md).

## Upgrading from v0.21

v0.22 grouped the flat options under the .NET configuration paths and renamed the options type. Code that still uses the old names no longer compiles:

| Before v0.22 | Now |
| --- | --- |
| `ArcServerOptions` | `ArcOptions` |
| `correlationHeader` | `correlationId.httpHeader` |
| `tenantHeader` | `tenancy.httpHeader` |
| `resolveTenant` | `tenancy.resolve` |
| `enableQueryMethod` | `generatedApis.enableQueryHttpMethod` |
| `openApiVersion` | `generatedApis.openApiVersion` |
| `maxBodyBytes` | `hosting.maxBodyBytes` |
| `observableKeepAliveIntervalMs` | `query.keepAliveIntervalMs` |
| `allowedOrigins` | `query.allowedOrigins` |
| `maxObservable*`, `observableHandshakeTimeoutMs`, `observableShutdownTimeoutMs`, `enableObservableHealth`, `observableEmissionGuards` | The same names under `query` |

In `appsettings.json`, use the grouped paths from [the ArcOptions tree](#the-arcoptions-tree). A flat key such as `Cratis:Arc:CorrelationHeader` does not bind; with a `logger` configured, Arc reports it as an unknown key.
