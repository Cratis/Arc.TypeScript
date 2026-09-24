---
title: Configure the server
description: Set route prefixes and explicit paths, resolve tenants, limit request bodies, control error details, and look up every ArcServer option.
---

Everything about how Arc for TypeScript serves your definitions is set in one place: the options object you pass to `new ArcServer(...)`. This guide covers the settings you are most likely to change, then lists every option.

:::note[Unpublished source]
These options come from the current source and can still change. Identity and tenant strategies are opt-in, not complete .NET parity. See the [capability reference](../reference/capabilities.md).
:::

## A configured server

```typescript title="arc.ts"
import { ArcServer, AuthenticationStatus, currentContext, defineCommand, defineQuery } from '@cratis/arc.server';
import type { AuthenticationHandler } from '@cratis/arc.server';
import { z } from 'zod';

// Development only: a fixed token instead of real token verification.
const developmentUser: AuthenticationHandler = request =>
    request.headers.get('authorization') === 'Bearer ada-dev-token'
        ? { status: AuthenticationStatus.Authenticated, principal: { id: 'ada', roles: ['editor'], isAuthenticated: true } }
        : { status: AuthenticationStatus.Anonymous };
const tenantsByUser = new Map([['ada', 'acme']]);

const create = defineCommand({
    name: 'CreateTask',
    namespace: 'Acme.Tasks',
    summary: 'Creates a task',
    schema: z.object({ id: z.string(), title: z.string() }),
    authorization: { authenticated: true },
    authorize: (_input, context) => context.tenantId !== undefined,
    handle: ({ id }) => ({ id, tenant: currentContext()?.tenantId })
});

const byId = defineQuery({
    name: 'ById',
    namespace: 'Acme.Tasks',
    path: '/tasks/by-id',
    schema: z.object({ id: z.string() }),
    authorization: { authenticated: true },
    authorize: (_input, context) => context.tenantId !== undefined,
    perform: ({ id }, context) => ({ id, tenant: context.tenantId })
});

export const arc = new ArcServer({
    commands: [create],
    queries: [byId],
    prefix: 'api',
    segmentsToSkip: 1,
    maxBodyBytes: 64 * 1024,
    authentication: [developmentUser],
    resolveTenant: (_request, principal) => principal ? tenantsByUser.get(principal.id) : undefined,
    development: process.env.NODE_ENV === 'development',
    logger: (error, correlationId) => console.error(correlationId, error)
});
```

This server serves `POST /api/tasks/create-task`, `POST /api/tasks/create-task/validate`, and `GET /tasks/by-id`, and takes the tenant from the authenticated user instead of from a header. The sections below explain why.

## Shape the routes

Arc builds a route from the prefix, the namespace, and the name:

1. Start with `prefix`, which defaults to `api`. Set it to an empty string to serve routes without a prefix. A prefix may contain letters, digits, `_`, `-`, and `/` between segments.
2. Split `namespace` on dots and drop the first `segmentsToSkip` segments. `Acme.Tasks` with `segmentsToSkip: 1` leaves `Tasks`.
3. Convert each remaining namespace segment and the name to kebab case. Acronyms stay together: `CreateTask` becomes `create-task`, `HTTPReader` becomes `http-reader`, and `_` becomes `-`.

Each command also gets a validation route: its registered route followed by `/validate`. A command whose own route ends in `/validate`, such as one named `Validate`, still executes on that route.

To choose a route yourself, set `path` on the definition. The path must start with a single `/`, contain only letters, digits, `/`, `_`, and `-`, and must not contain `..`. A trailing slash is removed, and the prefix is not added.

## What the constructor rejects

The `ArcServer` constructor throws, so the process fails at startup instead of serving a weakened contract, when:

- a name or any namespace segment does not start with a letter or contains anything but letters, digits, and `_`. This applies even when `path` is set;
- a `path` or `prefix` is unsafe, or `segmentsToSkip` is not a non-negative integer;
- `maxBodyBytes` or any observable resource bound is not a positive safe integer, such as `0`, a fraction, `NaN`, or `Infinity` (the keep-alive interval alone also accepts zero);
- `allowedOrigins` is not a list of exact `http`/`https` origins or a predicate;
- two operations share a namespace and name, compared case-insensitively;
- two routes collide, including a command's `/validate` route and the reserved identity, discovery, metadata, and OpenAPI paths;
- an `authorization` declaration combines `anonymous: true` with `authenticated: true` or with `roles`. `anonymous: true` together with an `authorize` callback is allowed, and the callback still runs;
- a schema has properties whose names differ only in case, or cannot be converted to JSON Schema.

## Disable the QUERY method

Queries accept GET and the HTTP `QUERY` method by default. Set `enableQueryMethod: false` to accept GET only. A `QUERY` request then answers 405 with `Allow: GET`.

## Limit request bodies

`maxBodyBytes` caps the JSON body of a command or `QUERY` request. The default is 1 MiB (1,048,576 bytes). A larger body, measured by `Content-Length` or while reading, answers 400 with the reason `malformedRequest`. The server also rejects bodies that are not UTF-8 JSON, contain non-finite numbers, nest deeper than 32 levels, or use the keys `__proto__`, `prototype`, or `constructor`. Behind Fastify, Fastify's own `bodyLimit` applies first; see [Host Arc in Express, Fastify, or Hono](host-integration.md#mount-in-fastify-5).

## Correlate requests

Every result carries a correlation ID, which is also sent in the `X-Correlation-ID` response header. When the request carries a valid, non-zero UUID in that header, Arc reuses it in lowercase; otherwise it generates one. Set `correlationHeader` to use another header name for both directions.

## Resolve the tenant

Without `resolveTenant`, Arc reads the tenant from the `x-cratis-tenant-id` request header, and `tenantHeader` changes the header name. The value is available as `context.tenantId` and is `undefined` when the header is missing.

With `resolveTenant(request, principal)`, the resolver alone decides. It runs after authentication, so it can read the authenticated principal, and it may be `async`. When it returns `undefined`, the tenant is `undefined`; Arc does not fall back to the header or use `tenancy` strategies, membership enforcement, or `required`.

For a selected chain of built-in sources, omit `resolveTenant` and specify their exact order:

```typescript title="arc.ts"
const arc = new ArcServer({
    authentication: [developmentUser],
    tenancy: {
        sources: ['claim', 'header'],
        claimType: 'tenant',
        membershipClaim: 'tenants',
        required: true
    }
});
```

This tries an own claim on a verified authenticated principal first, then `x-cratis-tenant-id`. A missing tenant gets 400; a selected tenant requires an authenticated principal with its own nonempty `tenants` claim (comma-separated IDs) listing that tenant, or gets 403. `Principal.claims` remains handler-defined for compatibility. Tenant strategies consume only own string values from a claim object: a nonstring selected tenant claim gets 400, and a nonstring membership claim gets 403. Unused identity fields and claims do not impose an authentication-stage size or cardinality limit. A header only names a requested tenant, **not** membership proof. Without `membershipClaim`, built-in sources do not check membership; enforce it in `authorize` or resolve from a trusted directory. `query` reads `tenantId` from the query string by default; `fixed` uses `fixed`; `subdomain` requires an ASCII `baseDomain` (at least two DNS labels) and an explicitly host-verified `authority` passed from the adapter callback. Only a *single* subdomain label matches; IPs, unrelated or multi-label hosts, and raw `Host`/forwarded headers never do. No implicit fallback or development strategy is installed. Nonempty IDs are lowercased and must be DNS labels (letters, digits, hyphens, at most 63 characters); invalid selected IDs get 400. Set `sources: ['subdomain', 'header']` to request an explicit header fallback. Other strategy errors and unsafe startup options fail closed.

:::danger[The legacy header is not membership enforcement]
Without `tenancy` or `resolveTenant`, Arc takes the header unchanged and does not check tenant membership. Even with `tenancy`, enforcement requires `membershipClaim` on a verified principal. When tenants separate customers' data, derive the tenant from the principal in `resolveTenant`, or check it in `authorize`. Do not enforce it in a validator: a trusted direct caller can lower blocking severity. See [Validate and authorize commands and queries](validation-and-authorization.md#choose-how-strict-warnings-are).
:::

## Read the context anywhere in a request

Every callback receives the execution context as a parameter: `correlationId`, `principal`, `tenantId`, `signal`, and `allowedSeverity`. The context is frozen. For code that has no access to that parameter, such as a repository deep in a call chain, `currentContext()` returns the same context while a request handled by `ArcServer` or a direct `executeCommand` or `performQuery` call runs. It uses Node.js `AsyncLocalStorage`, so concurrent requests never see each other's context, and it returns `undefined` outside them.

## Control error details

When a callback throws, the result is a 500 with `hasExceptions: true`. What an HTTP caller sees depends on `development`:

| `development` | `exceptionMessages` | `exceptionStackTrace` |
| --- | --- | --- |
| `false` (default) | `["An unexpected error occurred"]` | Empty |
| `true` | The original messages | The original stack trace |

Leave `development` off in any environment a real user can reach. To keep the original error, pass `logger(error, correlationId)`. For HTTP requests, Arc calls it for every exception in a result, for a validator that throws, and for unexpected failures in the pipeline, whatever `development` is set to. When several failures happen in one command, such as a handler and a scope, the logger receives an `AggregateError` holding them. Without a logger, Arc does not log anything. A logger that throws or rejects is attempted once; Arc returns a generic, redacted 500 envelope with the correlation ID instead of exposing the logger's error through the host. Direct calls are neither redacted nor logged.

## Describe identity details and operations

Use `identityDetails` to register `GET /.cratis/me`. Pair the callback with a Zod details schema; schema requests return its derived JSON Schema. The legacy `identityDetailsSchema` option still returns its value unchanged when no provider is configured; it cannot be combined with `identityDetails`.

```typescript title="arc.ts"
import { ArcServer, AuthenticationStatus } from '@cratis/arc.server';
import { z } from 'zod';

// Local development only; verify real credentials with a trusted authenticator.
const arc = new ArcServer({
    authentication: [request => request.headers.get('authorization') === 'Bearer local-dev'
        ? { status: AuthenticationStatus.Authenticated, principal: { id: 'ada', name: 'Ada', roles: ['reader'], isAuthenticated: true } }
        : { status: AuthenticationStatus.Anonymous }],
    identityDetails: {
        schema: z.object({ greeting: z.string() }),
        provide: (principal, context) => ({ greeting: `Hello ${principal.name} (${context.tenantId ?? 'none'})` })
    }
});
```

With an authenticated request, `GET /.cratis/me` returns `{id,name,isAuthenticated:true,isAuthorized:true,roles,details}` and a Base64 `.cratis-identity` display cookie (`Path=/; SameSite=Lax`, not `HttpOnly`); anonymous returns 401, a provider returning `undefined` denies with 403. Its response always has `Cache-Control: no-store`. The cookie is not signed and **must never** be used to authenticate or authorize. The provider runs in the current execution context with owned scoped services, even on denial or error. Failure, including a rejected provider promise, returns a generic 500 without leaking provider details or setting an identity cookie. The JSON response retains Unicode; the cookie escapes non-ASCII JSON code units before Base64 so the existing client's `JSON.parse(atob(cookie))` can recover names and details, including emoji. The complete encoded Set-Cookie header is limited to 4096 bytes; oversized identities fail with a generic 500 rather than a partial display identity. Cookie bytes are not guaranteed to match .NET's JSON escaping.

`/.cratis/users` and `/.cratis/tenants` return `[]` until you set `development: true` and explicitly supply `developmentUsers(context)` or `developmentTenants(context)` callbacks. Both routes are anonymous: never return secrets, production user inventories, or real tenant memberships. User entries have `{microsoftIdentity:{identityProvider,userId,userDetails,userRoles,claims:[{typ,val}]},details?}`; tenant entries have `{id,name}`. Results are capped at 100 entries and 32 KiB, preserving provider order and duplicates; invalid or failing providers return a generic 500. Discovery providers also have per-request owned service scopes.

`summary` on a definition appears as `documentationSummary` in `/.cratis/commands` and `/.cratis/queries`, and as the operation summary in `/openapi.json`. The OpenAPI document uses OpenAPI 3.1, lists commands as POST with a JSON request body and queries as GET with query parameters, and has the fixed title `Arc` and version `0.1.0`.

## ArcServer options

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `commands` | `CommandDefinition[]` | `[]` | Commands to serve, usually from `defineCommand` |
| `services` | `ServiceRegistration[] \| ServiceRegistry` | Empty registry | Owned service registrations or an externally owned registry; see [Compose services and test pipelines](services-and-testing.md) |
| `queries` | `QueryDefinition[]` | `[]` | Queries to serve, usually from `defineQuery` |
| `observableQueries` | `ObservableQueryDefinition[]` | `[]` | Live query sources, declared with `defineObservableQuery` |
| `observableEmissionGuards` | `ServiceToken<ObservableEmissionGuard>[]` | `[]` | Scoped policies checked before each observable emission |
| `enableObservableHealth` | `boolean` | `false` | Caller-scoped hub health query, authenticated only |
| `allowedOrigins` | `string[] \| (origin, request, native) => boolean \| Promise<boolean>` | Same-origin | Browser Origin policy for WS upgrades and SSE hub controls; an explicit list replaces the default |
| `prefix` | `string` | `'api'` | First route segments; empty for none |
| `segmentsToSkip` | `number` | `0` | Leading namespace segments left out of routes |
| `enableQueryMethod` | `boolean` | `true` | Accept the `QUERY` method on query routes |
| `maxBodyBytes` | `number` | `1048576` | Largest accepted request body; must be a positive safe integer |
| `maxObservableSubscriptions` / `maxObservableSubscriptionsPerCaller` | `number` | `4096` / `4096` | Live and opening subscriptions globally / per principal or anonymous connection/address |
| `maxObservableHubConnections` / `maxObservableHubConnectionsPerCaller` | `number` | `512` / `512` | Physical hub connections globally / per caller |
| `maxObservableHubSubscriptionsPerConnection` | `number` | `256` | Subscriptions on one hub connection |
| `maxObservableInboundFrames` / `maxObservableOutboundFrames` | `number` | `256` / `256` | Bounded transport queues |
| `maxObservablePendingEmissions` | `number` | `256` | Pending snapshots from one structural subscribable |
| `maxObservableInboundFrameBytes` / `maxObservableOutboundFrameBytes` | `number` | `65536` / `1048576` | Maximum incoming WS frame or SSE control JSON / outgoing frame |
| `maxObservableTombstones` | `number` | `1024` | Unsubscribe tombstones retained per hub connection for two minutes |
| `observableHandshakeTimeoutMs` | `number` | `10000` | Maximum time to complete a Node WS upgrade handshake |
| `observableKeepAliveIntervalMs` | `number` | `30000` | Idle time before a hub Ping; `0` disables keep-alive |
| `correlationHeader` | `string` | `'X-Correlation-ID'` | Header read and written for the correlation ID |
| `tenantHeader` | `string` | `'x-cratis-tenant-id'` | Header read for the tenant when there is no `resolveTenant` |
| `resolveTenant` | `(request, principal) => string \| undefined`, or a promise of it | None | Resolves the tenant; its result is final |
| `authentication` | `AuthenticationHandler[]` | `[]` | Handlers tried in order to authenticate the caller |
| `nativePrincipal` | `boolean` | `false` | Trust only an explicit adapter-provided verified principal; cannot coexist with authentication handlers |
| `tenancy` | `TenancyOptions` | None | Explicit ordered `sources` (`header`, `query`, `claim`, `fixed`, `subdomain`); optional `queryParameter`, `claimType`, `fixed`, `baseDomain`, `required`, `membershipClaim` |
| `development` | `boolean` | `false` | Return exception messages and stack traces to HTTP callers |
| `logger` | `(error, correlationId) => void`, or a promise of `void` | None | Receives the original error for failed HTTP requests |
| `identityDetailsSchema` | `Record<string, unknown>` | `{}` | Legacy schema body when no provider is configured |
| `identityDetails` | `{schema: z.ZodType, provide(principal, context): unknown}` | None | Registers conditional me route; `undefined` denies; details must parse as schema |
| `developmentUsers` | `(context) => DevelopmentUser[]`, or a promise | None | Explicit development-only anonymous discovery provider |
| `developmentTenants` | `(context) => DevelopmentTenant[]`, or a promise | None | Explicit development-only anonymous discovery provider |

Commands and queries share the fields `name` (required), `namespace`, `path`, `summary`, `schema` (required), `authorization`, `authorize`, `validate`, `filters`, `handlerDependencies`, and `validatorDependencies`. A command also takes `handle` (required), `provide`, and `scopes`. A query takes `perform` (required); an observable query takes `observe` (required) and may return an async iterable or structural subscribable. See [Stream an observable query](observable-queries.md).

## Related

- [Host Arc in Express, Fastify, or Hono](host-integration.md)
- [Validate and authorize commands and queries](validation-and-authorization.md)
- [Capability reference](../reference/capabilities.md)
