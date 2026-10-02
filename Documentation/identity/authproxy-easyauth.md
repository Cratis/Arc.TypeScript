---
title: Accept AuthProxy or EasyAuth identity headers
description: Run microsoftIdentityPlatform only behind a sanitizing authentication ingress, block backend bypasses, and choose a durable Entra user key.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Use `microsoftIdentityPlatform()` when AuthProxy or Azure App Service EasyAuth authenticates the caller **before** forwarding the request to Arc. Arc consumes the forwarded principal; it does not verify a token, contact the provider, or validate a login session in this handler. No separate Arc provider SDK is needed.

:::danger[Base64 is not authentication]
An attacker who reaches this handler directly can construct a principal and grant themselves roles. Removing reserved claims inside the payload does **not** make caller-supplied principal headers safe.
:::

## Establish the ingress boundary first

For a self-hosted AuthProxy deployment, the request path must be: public HTTPS ingress, AuthProxy authentication, then a private Arc listener. Configure the **public boundary before authentication** to remove every incoming header whose name starts with `x-ms-client-principal`, case-insensitively. This includes the principal payload, ID, name, IDP and any suffix, not just the three headers Arc currently reads. After successful authentication, only the trusted proxy may write replacement identity headers. Unauthenticated requests must not carry identity headers upstream.

Do not strip the verified headers on the internal hop **after** the authentication proxy. Restrict who can reach that hop and the backend instead:

- On a shared host, bind Arc to `127.0.0.1` and let only a trusted local proxy connect. Other processes on that host remain inside the trust boundary; loopback is not process isolation.
- With containers, do not publish the Arc port. Put Arc on a private network with only the authentication proxy and enforce network policy/firewall rules. Do not assume a private IP or a Kubernetes Service by itself blocks other workloads.
- Block public backend hostnames, load-balancer targets, alternate ports and WebSocket paths that bypass authentication. Protect the proxy-to-Arc connection with TLS/mTLS when it crosses a network trust boundary.
- For managed App Service EasyAuth, enable authentication on the app and verify there is no path around that module. Microsoft states that [external requests cannot set the injected identity headers](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities#access-user-claims-in-app-code). This is an App Service guarantee, **not** a guarantee of an arbitrary reverse proxy or a copied header.

Provider selection, login callbacks, session storage and logout belong to AuthProxy/EasyAuth. Configure their tenant, client registration and session requirements using that product's deployment instructions. Arc's display cookie is not that session.

## Configure the private Arc backend

In an [Arc Node project](../core/index.md), compile and run this entry point behind the boundary above. It binds only to loopback. Configure the proxy's backend target as `http://127.0.0.1:3000`; this topology requires both processes to share a trusted host/network namespace.

```typescript title="main.ts"
import { ArcServer, defineQuery, microsoftIdentityPlatform, runArc } from '@cratis/arc.core';
import { z } from 'zod';

const server = new ArcServer({
    authentication: [microsoftIdentityPlatform()],
    queries: [defineQuery({
        name: 'RoleReports',
        schema: z.object({}),
        authorization: { roles: ['Reports.Read'] },
        perform: () => 'role granted'
    })],
    identityDetails: {
        schema: z.object({ greeting: z.string() }),
        provide: principal => ({ greeting: `Hello ${principal.name ?? principal.id}` })
    }
});
const host = await runArc(server, { host: '127.0.0.1', port: 3000 });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void host.shutdown(); });
}
```

Apply authorization to every protected command and query. Merely registering the handler does not make every operation require authentication. Do not mix forwarded-header authentication into a publicly reachable Bearer route as a convenient fallback.

## Know the forwarded fields Arc consumes

All three headers must be present: `x-ms-client-principal`, `x-ms-client-principal-id`, and `x-ms-client-principal-name`. Missing headers leave the request anonymous. An empty ID, malformed Base64/JSON or invalid payload fails authentication. Arc currently interprets them as follows:

| Arc value | Source |
| --- | --- |
| `principal.id` | `x-ms-client-principal-id`, not the payload's `userId` |
| `principal.name` | Decoded payload `userDetails`, defaulting to `""`; not the name header |
| `principal.roles` | Payload `userRoles` plus claims named `http://schemas.microsoft.com/ws/2008/06/identity/claims/role` |
| `claims.sub` and the .NET name-identifier claim | Rewritten from the forwarded ID |
| .NET name claim | Rewritten from `userDetails` |
| `urn:cratis:arc:identity:provider` | Payload `identityProvider`, only when nonblank |

Inbound `sub` and `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier` are removed with **case-sensitive** matching. Provider-claim removal is ASCII case-insensitive. Other claim names remain case-sensitive and are copied; duplicate claim types retain their last value in the dictionary, while standard role claims also accumulate in the roles list. Never authorize against a differently cased lookalike reserved claim.

### App Service envelope versus AuthProxy extensions

Microsoft's documented App Service envelope has `auth_typ`, `claims`, `name_typ` and `role_typ`. Arc accepts its `claims` array, but does not use those three metadata fields or the `x-ms-client-principal-idp` header. The `identityProvider`, `userDetails` and `userRoles` fields are a different, extended envelope shape; do not assume every EasyAuth deployment supplies them.

With the plain App Service envelope, authentication still uses the ID header and roles still work through the standard Microsoft role claim. The displayed name is empty and Arc's provider metadata claim is absent. Custom `role_typ` mappings are not interpreted. Confirm the actual envelope produced by your ingress; if you need a display name, provide an application-owned display field through identity enrichment from a trusted directory lookup. Do not treat a blank name as failed authentication or rewrite core authorization to trust display details.

## Choose a durable user key

`identityProvider` (often a label such as `aad`), `auth_typ`, the IDP header, and Entra's `idp` claim describe an authentication provider. They are **not** a durable user key or a verified issuer/tenant boundary.

For an Entra directory user, persist the verified **tenant ID (`tid`) plus object ID (`oid`)**. With App Service claim mapping, these commonly appear in the forwarded claim dictionary as `http://schemas.microsoft.com/identity/claims/tenantid` and `http://schemas.microsoft.com/identity/claims/objectidentifier`. Confirm the mapping at your trusted ingress; Arc does not rename these claims. Fail your application's lookup if the required identifiers are missing or ambiguous rather than falling back to email, name, or a provider label.

A verified `sub`, scoped to its issuer/application, is appropriate for an application-local identifier, but is pairwise and changes across application registrations. In this handler **Arc rewrites `sub` to the forwarded ID**; it is no longer necessarily the original token's subject. Do not assume that the forwarded ID equals the Entra object ID either. Retain `tid`/`oid` explicitly for cross-service directory relationships, and keep guest identities in different tenants separate. Microsoft's [stable identity guidance](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#use-claims-to-reliably-identify-a-user) explains this distinction. App-only callers have service-principal object IDs, not human user IDs.

## Verify your actual deployment

Before exposing this configuration, test from **outside** the trusted network boundary. A unit test that injects trusted headers directly into Arc cannot verify your ingress rules.

| Probe | Required result |
| --- | --- |
| Signed-in caller with `Reports.Read` through the public ingress | `/api/role-reports` succeeds; `/.cratis/me` identifies that caller |
| Signed-in caller without that role | Role query returns 403 |
| Anonymous caller supplies a forged payload, ID, name and IDP header | Ingress challenges/rejects, or Arc returns 401; no forged identity appears |
| Signed-in unprivileged caller adds forged admin headers, mixed-case names and duplicate header values | Ingress removes them and forwards only its verified identity; no role escalation |
| Caller connects directly to the Arc backend address/port or an alternate hostname | Connection is blocked before it reaches Arc |
| Request carries only `.cratis-identity`, without the proxy's real login session | No authenticated principal; `/.cratis/me` cannot succeed |
| The same probes use an observable upgrade or SSE hub path | The same ingress boundary holds; see [observable authentication](observable-authentication.md) |

Use a nonproduction account and inspect only the minimum identity fields; do not log tokens or full principal headers. Test the wildcard stripping rule at the public boundary and the network restrictions independently. Authenticated traffic succeeding is not evidence that either protection works.

The repository specs exercise the handler, reserved claims, role authorization, identity enrichment and display-cookie replay without a provider connection. They do not certify an AuthProxy or Azure deployment. The deployment probes above must be run against the infrastructure you will expose.

## Related

- [Entra API bearer tokens](entra-bearer.md) when Arc, rather than a proxy, verifies the token
- [Identity contracts](contracts.md) for `/.cratis/me` and the display cookie
- [Observable transport authentication](observable-authentication.md)
