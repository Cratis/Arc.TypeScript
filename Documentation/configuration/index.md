---
title: Configuration
description: Configure Arc through its grouped ArcOptions tree, appsettings.json, environment variables, or code.
---

Arc reads its settings from one `ArcOptions` object. The TypeScript groups follow the same `Cratis:Arc` paths as [Arc on .NET](https://github.com/Cratis/Arc/blob/main/Documentation/backend/csharp/configuration/index.md): `CorrelationId`, `Tenancy`, `GeneratedApis`, `Query`, `Hosting`, and `ExposeExceptionDetails`. Node-specific transport limits and registration hooks live in those groups or alongside them as noted below.

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

## The ArcOptions tree

The paths below are relative to `Cratis:Arc` in configuration and camelCase in TypeScript. `.NET` settings with different value representations are called out explicitly. Unspecified options use the documented defaults.

| Configuration path / TypeScript path | Default | Effect |
| --- | --- | --- |
| `ExposeExceptionDetails` / `exposeExceptionDetails` | `true` only when the effective environment is Development | Include original exception messages and stack traces in serialized HTTP results; otherwise redact them. This does not enable development discovery. |
| `CorrelationId:HttpHeader` / `correlationId.httpHeader` | `X-Correlation-ID` | Correlation ID request and response header. |
| `Tenancy:ResolverType` / `tenancy.resolverType` | `header` when `tenancy` is present | Single `header`, `query`, `claim`, `subdomain`, `development`, or `fixed` source. |
| `Tenancy:HttpHeader` / `tenancy.httpHeader` | `x-cratis-tenant-id` | Header source; also the fallback for `resolverType: 'subdomain'` or an ordered `['subdomain', 'header']` list. |
| `Tenancy:BaseDomain` / `tenancy.baseDomain` | None | Required for the verified subdomain source; exactly one preceding DNS label matches. |
| `Tenancy:QueryParameter` / `tenancy.queryParameter` | `tenantId` | Query-string source. |
| `Tenancy:ClaimType` / `tenancy.claimType` | `tenant_id` | Claim source; only own string claims on authenticated principals count. |
| `Tenancy:FixedTenantId` / `tenancy.fixedTenantId` | `development` | Fixed or development source. The .NET `DevelopmentTenantId` configuration name also binds this value; do not supply both names. |
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

Per-caller defaults equal global limits: set smaller per-caller budgets for internet-facing hosts. Exhausted admission answers 503 with `Retry-After: 1`; an exhausted handshake answers HTTP 503 or WebSocket close 1013. The keep-alive interval alone accepts zero. `query.allowedOrigins` accepts a string array in code; the configuration binder does not accept Origin lists or predicates.

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

The builder also rejects misplaced decorators, duplicate validator targets, missing service registrations, dependency cycles, and captive lifetimes.

## Low-level definition fields

`defineCommand` and `defineQuery` share `name` (required), `namespace`, `path`, `summary`, `schema` (required), `authorization`, `authorize`, `validate`, `filters`, `handlerDependencies`, `validatorDependencies`, and `clientOutput`. A command also takes `handle` (required), `provide`, and `scopes`. A query takes `perform` (required); an observable query takes `observe` (required). See [Low-level definitions](../commands/low-level-definitions.md).
