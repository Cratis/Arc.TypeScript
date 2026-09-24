---
title: Configure the server
description: Set route prefixes and explicit paths, resolve tenants, limit request bodies, control error details, and look up every ArcServer option.
---

Everything about how Arc for TypeScript serves your definitions is set in one place: the options object you pass to `new ArcServer(...)`. This guide covers the settings you are most likely to change, then lists every option.

:::note[Unpublished source]
These options come from the current source and can still change. Tenant resolvers other than a header or your own function, development users and tenants, and `/.cratis/me` are not implemented. See the [capability reference](../reference/capabilities.md).
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
- `maxBodyBytes` is not a positive safe integer, such as `0`, a negative number, a fraction, `NaN`, or `Infinity`;
- two operations share a namespace and name, compared case-insensitively;
- two routes collide, including a command's `/validate` route and the reserved paths `/.cratis/commands`, `/.cratis/queries`, `/.cratis/identity-details/schema`, and `/openapi.json`;
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

With `resolveTenant(request, principal)`, the resolver alone decides. It runs after authentication, so it can read the authenticated principal, and it may be `async`. When it returns `undefined`, the tenant is `undefined`; Arc does not fall back to the header.

:::danger[Arc does not check tenant membership]
Arc trusts the tenant value it resolves. With the default header, the caller chooses the tenant. Arc never checks that the tenant exists or that the caller belongs to it. When tenants separate customers' data, derive the tenant from the principal in `resolveTenant`, or check it in `authorize`. Do not enforce it in a validator: validators are business rules, and a trusted direct caller can lower the severity that blocks them. See [Validate and authorize commands and queries](validation-and-authorization.md#choose-how-strict-warnings-are).
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

`identityDetailsSchema` is returned as-is from `GET /.cratis/identity-details/schema`, and defaults to `{}`. It only describes the shape; Arc for TypeScript does not serve identity details.

`summary` on a definition appears as `documentationSummary` in `/.cratis/commands` and `/.cratis/queries`, and as the operation summary in `/openapi.json`. The OpenAPI document uses OpenAPI 3.1, lists commands as POST with a JSON request body and queries as GET with query parameters, and has the fixed title `Arc` and version `0.1.0`.

## ArcServer options

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `commands` | `CommandDefinition[]` | `[]` | Commands to serve, usually from `defineCommand` |
| `queries` | `QueryDefinition[]` | `[]` | Queries to serve, usually from `defineQuery` |
| `prefix` | `string` | `'api'` | First route segments; empty for none |
| `segmentsToSkip` | `number` | `0` | Leading namespace segments left out of routes |
| `enableQueryMethod` | `boolean` | `true` | Accept the `QUERY` method on query routes |
| `maxBodyBytes` | `number` | `1048576` | Largest accepted request body; must be a positive safe integer |
| `correlationHeader` | `string` | `'X-Correlation-ID'` | Header read and written for the correlation ID |
| `tenantHeader` | `string` | `'x-cratis-tenant-id'` | Header read for the tenant when there is no `resolveTenant` |
| `resolveTenant` | `(request, principal) => string \| undefined`, or a promise of it | None | Resolves the tenant; its result is final |
| `authentication` | `AuthenticationHandler[]` | `[]` | Handlers tried in order to authenticate the caller |
| `development` | `boolean` | `false` | Return exception messages and stack traces to HTTP callers |
| `logger` | `(error, correlationId) => void`, or a promise of `void` | None | Receives the original error for failed HTTP requests |
| `identityDetailsSchema` | `Record<string, unknown>` | `{}` | Body of `/.cratis/identity-details/schema` |

Commands and queries share the fields `name` (required), `namespace`, `path`, `summary`, `schema` (required), `authorization`, `authorize`, `validate`, and `filters`. A command also takes `handle` (required), `provide`, and `scopes`. A query takes `perform` (required).

## Related

- [Host Arc in Express, Fastify, or Hono](host-integration.md)
- [Validate and authorize commands and queries](validation-and-authorization.md)
- [Capability reference](../reference/capabilities.md)
