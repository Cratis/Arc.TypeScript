---
title: Authentication
description: Decide who verifies credentials, write or configure Arc authentication handlers for JWT bearer tokens or EasyAuth headers, and know what Arc never trusts.
---

Before an operation can say "editors only", something has to establish who the caller is. Arc does not infer a caller from a cookie or a forwarded header. You choose who verifies credentials, and the rest of the pipeline works from the principal that choice produces.

## Choose an authentication boundary

| Your host | Arc configuration | What must be trusted |
| --- | --- | --- |
| Express, Fastify, or Hono already authenticated the caller | `nativePrincipal: true` plus a verified adapter callback | The host's session or JWT middleware and the callback; see [Native principal](../hosts/native-principal.md) |
| Your Node server validates JWTs | `authentication: [jwtBearer({ jwksUrl, issuer, audience, algorithms })]` | An HTTPS JWKS URL and pinned issuer, audience, and algorithms |
| Azure EasyAuth or a reverse proxy forwards a principal | `authentication: [microsoftIdentityPlatform()]` | The ingress **must** strip client-supplied `x-ms-client-principal*` headers, set its own, and block direct backend access |
| Your own credential check | `authentication: [yourHandler]` | Your handler |

`nativePrincipal: true` and Arc authentication handlers are mutually exclusive.

## How the handler chain decides

An `AuthenticationHandler` receives the Fetch API `Request` and returns one of three results:

| Result | Meaning |
| --- | --- |
| `{ status: AuthenticationStatus.Anonymous }` | This handler does not recognize the request. The next handler runs. |
| `{ status: AuthenticationStatus.Authenticated, principal }` | The caller is known. No further handler runs. |
| `{ status: AuthenticationStatus.Failed }` | The request carried wrong credentials. The request ends with 401, whatever the operation requires. |

Handlers run in the order you list them and can be `async`. A principal must have `isAuthenticated: true`, a string `id`, and an array of string `roles`; `name`, `claims`, and `scheme` are optional. Arc copies and freezes the roles and the own claim dictionary, and freezes the principal it exposes as `context.principal`.

When no handler is configured, nobody is authenticated, and a protected operation answers 403 rather than 401.

## Write a handler

This handler is for local development only: it accepts one fixed token instead of verifying anything.

```typescript title="developmentUser.ts"
import { AuthenticationStatus, type AuthenticationHandler } from '@cratis/arc.core';

// Development only: a fixed token instead of real token verification.
export const developmentUser: AuthenticationHandler = request =>
    request.headers.get('authorization') === 'Bearer ada-dev-token'
        ? { status: AuthenticationStatus.Authenticated, principal: { id: 'ada', roles: ['editor'], isAuthenticated: true } }
        : { status: AuthenticationStatus.Anonymous };
```

Pass it with `ArcApplication.createBuilder({ authentication: [developmentUser] })`.

## Verify JWT bearer tokens

```typescript title="main.ts"
import { ArcApplication, jwtBearer } from '@cratis/arc.core';

const builder = ArcApplication.createBuilder({
    authentication: [jwtBearer({
        jwksUrl: new URL('https://login.example.com/.well-known/jwks.json'),
        issuer: 'https://login.example.com/',
        audience: 'tasks-api',
        algorithms: ['RS256']
    })]
});
```

`jwtBearer()` ignores requests without a Bearer authorization header, rejects invalid Bearer tokens, and verifies the signature, issuer, audience, expiration, and subject; issued-at is optional. It uses `jose` with a remote JWKS. `clockSkewSeconds` (default 0), `jwksTimeoutMs`, and `jwksCooldownMs` bound time drift and key retrieval. It requires an HTTPS JWKS URL, a nonempty audience, and an explicit asymmetric algorithm list. The principal's `id` is the token's `sub`, and its roles come from the `roles` or `role` claim. Keep tokens out of URLs.

`jwtBearer()` is specific to Arc for TypeScript; .NET hosts use ASP.NET Core authentication instead.

## Accept EasyAuth headers behind a trusted ingress

`microsoftIdentityPlatform()` reads the `x-ms-client-principal`, `x-ms-client-principal-id`, and `x-ms-client-principal-name` headers. It is opt-in. Partial headers are anonymous; a malformed encoded principal or an empty principal ID fails authentication.

It builds the principal the way Arc on .NET does: `id` from `x-ms-client-principal-id`, `name` from the encoded `userDetails` (not the name header). It removes inbound `sub`, .NET `NameIdentifier`, and `urn:cratis:arc:identity:provider` claims before writing them from the forwarded fields, copies other claims, and uses `userRoles` and existing role claims for roles. The forwarded provider field is metadata, not a durable issuer key.

:::danger[An EasyAuth header is base64, not a signature]
Anyone who can reach the backend directly can send these headers. Only enable `microsoftIdentityPlatform()` behind an ingress that strips caller-supplied identity headers and blocks direct traffic. Never enable it together with another handler on an untrusted route without deciding which one recognizes a credential first.
:::

## Named schemes

Register `authenticationSchemes: { Verified: handler }` to keep a handler out of the default chain and select it per operation with `@authorize({ schemes: ['Verified'] })`. See [Authorization policies and schemes](authorization.md#select-an-authentication-scheme).

## What Arc never trusts

- The `.cratis-identity` cookie is display data for the frontend. Neither handler, nor anything else in Arc, turns it into a credential. See [Identity](../identity/index.md).
- `X-Forwarded-*` headers never become a principal, a TLS flag, or an authority by themselves.
- By default, the Express, Fastify, and Hono adapters do not pass on a user that the framework's own middleware authenticated. Bridge it explicitly with a [native principal](../hosts/native-principal.md).

## Related

- [Authorizing commands and queries](../authorizing-commands-and-queries.md)
- [Authorization policies and schemes](authorization.md)
- [WebSockets](../hosts/websockets.md) for authenticating upgrades
