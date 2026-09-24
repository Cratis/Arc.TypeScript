---
title: Configuration
description: Every ArcOptions setting accepted by the application builder and ArcServer, its default and effect, and what startup rejects.
---

On Node.js, `ArcApplication.createBuilder()` reads an optional `appsettings.json` from the working directory, then `Cratis__...` environment variables (case-insensitive), then applies code options. `ArcOptions` (also exported as `ArcServerOptions`) still configures the low-level server directly. The builder reads only serializable keys in the `Cratis:Arc`, `Cratis:Chronicle`, and `Cratis:MongoDB` sections; unknown keys and invalid types fail setup. No secret values appear in configuration errors.

```typescript
import { ArcApplication, ArcServer } from '@cratis/arc.core';

const builder = ArcApplication.createBuilder({ generatedApis: { routePrefix: 'api' }, maxBodyBytes: 64 * 1024 });
const server = new ArcServer({ commands: [], maxBodyBytes: 64 * 1024 });
```

`build()` merges builder registrations (discovered artifacts, `addAuthorizationPolicy`, `addQueryRenderer`, and so on) with the matching options. `new ArcServer(options)` stays explicit and does not load files or environment variables.

```json title="appsettings.json"
{"Cratis":{"Arc":{"GeneratedApis":{"RoutePrefix":"api"}},"Chronicle":{"ConnectionString":"chronicle://localhost:35000","EventStore":"Tasks"},"MongoDB":{"Database":"tasks"}}}
```

`CRATIS__ARC__GENERATEDAPIS__ROUTEPREFIX=backend` overrides the file. `Cratis__Chronicle__ConnectionString` and `Cratis__MongoDB__Server` work the same way. Keys are case-insensitive; a code option wins over the same file or environment key. Only `development`, `enableQueryMethod`, `openApiVersion`, `maxBodyBytes`, `correlationHeader`, `tenantHeader`, and the four `generatedApis` fields bind under `Cratis:Arc`. Chronicle binds `connectionString` and `eventStore`; MongoDB binds `server` and `database`. Handler functions, clients, models, and credentials represented as objects belong in code. Chronicle still requires both an event store and a connection string (or a client); MongoDB still needs `readModels` in code.

Use `ArcApplication.createBuilder({ configuration: false })` to opt out, or `{ configuration: { file: '/path/appsettings.json', env: suppliedEnvironment } }` to choose a file and environment. Invalid JSON is an error, not an absent file. Do not commit real connection strings to source control.

## Artifacts and services

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `commands` | `CommandDefinition[]` | `[]` | Low-level commands from `defineCommand` |
| `queries` | `QueryDefinition[]` | `[]` | Low-level queries from `defineQuery` |
| `observableQueries` | `ObservableQueryDefinition[]` | `[]` | Low-level live queries from `defineObservableQuery` |
| `services` | `ServiceRegistration[] \| ServiceRegistry` | Empty registry | Owned registrations, or an externally owned registry; see [Dependency injection](../dependency-injection.md) |
| `commandResponseValueHandlers` | Service identifiers | `[]` | Scoped handlers for server-side return values; see [Response value handlers](../commands/response-value-handlers.md) |
| `commandContextValuesProviders` | Service identifiers | `[]` | Scoped providers of named values on each `CommandContext` |
| `commandKeyResolvers` | Service identifiers | `[]` | Key rules run before the default `@key()`/`getKey()` rule; see [Command context](../commands/command-context.md) |
| `readModelForCommandResolvers` | Service identifiers | `[]` | Sources for `commandReadModel(...)` parameters |
| `commandExecutionRunner` | `(context, execute) => Promise<CommandResult>` | None | Wraps each validated command execution, for integrations that need ambient state |
| `commandCompensationTimeoutMs` | `number` | `30000` | Shared cooperative budget for [operation](../commands/operations/index.md) compensation |
| `queryRenderers` | Service identifiers | `[]` | Ordered scoped [renderers](../queries/renderers.md) |
| `readModelInterceptors` | Service identifiers | `[]` | Ordered scoped [interceptors](../queries/read-model-interception.md) |

## Routes and requests

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `generatedApis` | `{ routePrefix?, segmentsToSkipForRoute?, includeCommandNameInRoute?, includeQueryNameInRoute? }` | `{ routePrefix: 'api', segmentsToSkipForRoute: 0, includeCommandNameInRoute: true, includeQueryNameInRoute: true }` | Route convention; see [Endpoint mapping](../core/endpoint-mapping.md) |
| `prefix`, `segmentsToSkip`, `includeCommandNameInRoute`, `includeQueryNameInRoute` | Deprecated aliases | As in `generatedApis` | Flat forms; nested values take precedence |
| `enableQueryMethod` | `boolean` | `true` | Accept the HTTP `QUERY` method on query routes; when `false`, `QUERY` answers 405 with `Allow: GET` |
| `openApiVersion` | `string` | `'0.1.0'` | Version advertised in `GET /openapi.json`; see [OpenAPI](../open-api/index.md) |
| `maxBodyBytes` | `number` | `1048576` | Largest command or `QUERY` body; must be a positive safe integer |
| `correlationHeader` | `string` | `'X-Correlation-ID'` | Header read and written for the correlation ID |

A body larger than `maxBodyBytes`, measured by `Content-Length` or while reading, answers 400 `malformedRequest`. Arc also rejects bodies that are not UTF-8 JSON, contain non-finite numbers, nest deeper than 32 levels, or use the keys `__proto__`, `prototype`, or `constructor`. Behind Fastify, Fastify's own `bodyLimit` applies first.

Every result carries a correlation ID, also sent in the correlation response header. When the request carries a valid, non-zero UUID in that header, Arc reuses it in lowercase; otherwise it generates one.

## Security

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `authentication` | `AuthenticationHandler[]` | `[]` | Ordered handlers; see [Authentication](../core/authentication.md) |
| `authenticationSchemes` | `Record<string, AuthenticationHandler>` | `{}` | Named handlers selected by `@authorize({ schemes })` |
| `authorizationPolicies` | `Record<string, AuthorizationPolicy>` | `{}` | Named rules; the builder also has `addAuthorizationPolicy` |
| `nativePrincipal` | `boolean` | `false` | Trust only a host-verified principal from the adapter callback; see [Native principal](../hosts/native-principal.md) |
| `tenantHeader` | `string` | `'x-cratis-tenant-id'` | Header read for the tenant without `resolveTenant` or `tenancy` |
| `resolveTenant` | `(request, principal) => string \| undefined`, or a promise | None | Resolves the tenant; its answer is final |
| `tenancy` | `TenancyOptions` | None | Ordered built-in tenant sources; see [Tenant resolvers](../tenancy/resolvers.md) |
| `identityDetails` | `{ schema?, detailsType?, provide(principal, context) }` | None | Registers `/.cratis/me`; see [Identity](../identity/index.md) |
| `identityDetailsSchema` | `Record<string, unknown>` | `{}` | Legacy schema body when no provider is configured |
| `developmentUsers`, `developmentTenants` | Provider function or array of functions | None | Anonymous development discovery; see [Development users and tenants](../identity/development-users-and-tenants.md) |

## Errors and logging

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `development` | `boolean` | `false` | Return exception messages and stack traces to HTTP callers |
| `logger` | `(error, correlationId) => void`, or a promise | None | Receives the original error for failed HTTP requests |

When a callback throws, the result is a 500 with `hasExceptions: true`. Outside development, HTTP callers see `["An unexpected error occurred"]` and no stack trace. Leave `development` off anywhere a real user can reach.

The logger runs for every exception in an HTTP result, for a validator that throws, and for unexpected pipeline failures, whatever `development` says. Several failures in one command, such as a handler and a scope, arrive as one `AggregateError`. Without a logger, Arc logs nothing. A logger that throws or rejects is attempted once; Arc then returns a generic, redacted 500 with the correlation ID. Direct calls are neither redacted nor logged.

## Observable query limits

| Option | Default | Effect |
| --- | --- | --- |
| `allowedOrigins` | Same origin | Browser `Origin` policy for WebSocket upgrades and SSE hub controls: a list of exact `http`/`https` origins, or a predicate `(origin, request, native)`; see [WebSockets](../hosts/websockets.md#origin-checks) |
| `observableEmissionGuards` | `[]` | Scoped per-emission policies; see [Emission guards](../queries/observable-query-emission-guards.md) |
| `enableObservableHealth` | `false` | Caller-scoped hub health query; see [Query health](../queries/query-health.md) |
| `maxObservableSubscriptions` / `maxObservableSubscriptionsPerCaller` | `4096` / `4096` | Live and opening subscriptions globally / per principal or anonymous connection or address |
| `maxObservableHubConnections` / `maxObservableHubConnectionsPerCaller` | `512` / `512` | Physical hub connections globally / per caller |
| `maxObservableHubSubscriptionsPerConnection` | `256` | Subscriptions on one hub connection |
| `maxObservableInboundFrames` / `maxObservableOutboundFrames` | `256` / `256` | Queued transport frames |
| `maxObservablePendingEmissions` | `256` | Pending snapshots from one structural subscribable |
| `maxObservableInboundFrameBytes` / `maxObservableOutboundFrameBytes` | `65536` / `1048576` | Largest incoming WebSocket frame or SSE control body / outgoing frame |
| `maxObservableTombstones` | `1024` | Unsubscribe tombstones kept per hub connection, for two minutes |
| `observableHandshakeTimeoutMs` | `10000` | Deadline for a Node WebSocket upgrade handshake |
| `observableShutdownTimeoutMs` | `10000` | Deadline to join hub subscriptions and direct WebSocket work at shutdown |
| `observableKeepAliveIntervalMs` | `30000` | Idle time before a hub Ping; `0` disables keep-alive |

Per-caller defaults equal the global limits, so one caller can exhaust capacity. Set lower per-caller limits on internet-facing hosts. Exhausted admission answers 503 with `Retry-After: 1`; an exhausted handshake budget answers HTTP 503 or WebSocket close 1013.

## What startup rejects

`build()` and the `ArcServer` constructor throw, so the process fails before serving a weakened contract, when:

- a name or namespace segment does not start with a letter or contains anything but letters, digits, and `_`, even when an explicit path is set;
- a path or `routePrefix` is unsafe, or `segmentsToSkipForRoute` is not a non-negative integer;
- `maxBodyBytes` or an observable limit is not a positive safe integer (the keep-alive interval alone also accepts zero);
- `allowedOrigins` is not a list of exact `http`/`https` origins or a predicate;
- two operations share a namespace and name, compared case-insensitively, or two routes collide, including `/validate` routes and the reserved `/.cratis` and `/openapi.json` paths;
- an authorization declaration combines anonymous access with `authenticated`, `roles`, `policy`, or `schemes`, or names an unknown policy or scheme;
- `nativePrincipal` is combined with `authentication` handlers;
- a schema has properties whose names differ only in case, or cannot be converted to JSON Schema.

The builder additionally rejects misplaced decorators, duplicate validator targets, missing service registrations, dependency cycles, and captive lifetimes.

## Low-level definition fields

`defineCommand` and `defineQuery` share `name` (required), `namespace`, `path`, `summary`, `schema` (required), `authorization`, `authorize`, `validate`, `filters`, `handlerDependencies`, `validatorDependencies`, and `clientOutput`. A command also takes `handle` (required), `provide`, and `scopes`. A query takes `perform` (required). An observable query takes `observe` (required). See [Low-level definitions](../commands/low-level-definitions.md).
