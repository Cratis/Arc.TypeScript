---
title: Identity and authentication
description: Authenticate requests through verified bearer tokens, a trusted host principal, or a guarded EasyAuth ingress, and expose identity details safely.
---

Arc does not infer a caller from a cookie or a forwarded header. Choose who verifies credentials before protecting commands and queries. The identity returned to the browser is separate from the principal used for authorization.

:::caution[Source preview]
`@cratis/arc.core` is not published to npm. Configure and verify your chosen ingress before accepting traffic. An EasyAuth header is **base64, not a signature**.
:::

## Choose an authentication boundary

| Your host | Arc configuration | What must be trusted |
| --- | --- | --- |
| Express, Fastify, or Hono already authenticated the caller | `nativePrincipal: true` plus a verified adapter callback | Host session/JWT middleware and the callback; never use the display cookie |
| Your Node server validates JWTs | `authentication: [jwtBearer({ jwksUrl, issuer, audience, algorithms })]` | HTTPS JWKS URL and pinned issuer/audience/algorithms |
| Azure EasyAuth/reverse proxy forwards a principal | `authentication: [microsoftIdentityPlatform()]` | The ingress **must** strip client-supplied `x-ms-client-principal*`, set its own headers, and prevent direct backend access |

The handler chain uses the first authenticated or failed result; an anonymous result lets the next handler try. `jwtBearer()` is a TypeScript-only handler: .NET hosts use ASP.NET Core authentication. It ignores non-Bearer authorization headers, rejects invalid Bearer tokens, and verifies signature, issuer, audience, expiration and subject (issued-at is optional). It uses `jose`'s remote JWKS and accepts a nonnegative `clockSkewSeconds` (default zero), plus `jwksTimeoutMs` and `jwksCooldownMs` to bound remote key retrieval. It requires an HTTPS JWKS, a nonempty audience and an explicit asymmetric algorithm list. Keep tokens out of URLs. `microsoftIdentityPlatform()` is opt-in: partial headers are anonymous, malformed encoded principals or an empty principal ID fail authentication. Neither handler turns the `.cratis-identity` cookie into a credential.

EasyAuth reconstructs `id` from `x-ms-client-principal-id` and `name` from the encoded `userDetails` (not the name header), as .NET does. It removes inbound `sub`, .NET `NameIdentifier`, and `urn:cratis:arc:identity:provider` claims before writing them from the forwarded fields. It copies other claims and uses `userRoles` and existing role claims for role checks. The forwarded provider field is metadata, not a durable issuer key. A verified JWT, by contrast, uses `sub` as its id and `roles`/`role` for Arc roles. Never enable both mechanisms on the same untrusted route without deciding which recognizes a credential first.

For native principals, call `mountExpress(app, arc, verifiedContext)`, `mountFastify(app, arc, verifiedContext)`, or `mountHono(app, arc, verifiedContext)` with a callback that returns `{ principal }` only after host verification. `nativePrincipal: true` excludes Arc's default authentication handlers. Host sessions can use `HttpOnly`, `Secure`, and `SameSite` cookies according to the host framework's own session middleware; Arc does not implement or validate session cookies. WebSocket upgrades need the separate authenticated upgrade callbacks described in [Host integration](../guides/host-integration.md#mount-observable-websockets-on-nodejs).

## Give the browser identity details

Pass `identityDetails: { schema, provide }` to `ArcServer`, or mark a constructible provider class with `@identityDetailsProvider()` and add/discover it through `ArcApplicationBuilder`. The provider can declare a Zod `schema` or `detailsType` with Fundamentals `@field` metadata; the latter derives the JSON schema. Explicit `identityDetails` wins over discovered providers; more than one discovered provider without an explicit selection fails at build. Discovery constructs a provider per request; its constructor must take no arguments. Unlike .NET scoped DI discovery, this is explicit class discovery without constructor injection.

`GET /.cratis/identity-details/schema` returns the details schema (or `{}` without a provider). `GET /.cratis/me` is mapped only with a provider: 401 without a principal, 403 when `provide()` returns `undefined`, otherwise the identity JSON and a Base64 `.cratis-identity` cookie. The cookie is readable by JavaScript, `SameSite=Lax`, `Path=/`, and `Secure` when the trusted transport is HTTPS. It is **display data**, never an authorization credential. The serialized cookie is capped at 4096 bytes. See [Authorization](authorization.md) for server-side rules and [Tenancy](../tenancy/resolvers.md) for tenant selection.
