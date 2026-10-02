---
title: Authenticate an API with Microsoft Entra ID
description: Pin a tenant, API audience and signing keys with jwtBearer, then authorize app roles and delegated scopes without a provider SDK.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Use `jwtBearer()` when your Arc API receives **access tokens for that API**. This recipe validates tokens on the backend; it does not implement interactive sign-in, callbacks, or token refresh. No Microsoft provider SDK is required.

Start with an [Arc Node application](../core/index.md). Register a single-tenant API and a **separate client application** in Entra ID. On the API registration, expose a delegated scope named `Reports.Read` and an app role with the value `Reports.Read`. Grant the client the appropriate permission and consent; assign the app role to the user or service principal that needs it. The equal names below deliberately demonstrate that scopes and roles are separate permissions.

## Pin the token format, not the login endpoint

For this example, configure the API registration's `api.requestedAccessTokenVersion` as `2`. The **resource registration** controls the access-token version, not whether the client used a v1.0 or v2.0 authorization endpoint. Confirm the issuer and `jwks_uri` in the tenant-specific OpenID configuration before deployment.

For the public Microsoft cloud, using your directory's GUID as `TENANT_ID`:

| Access-token version | Exact issuer | API audience | Tenant-specific JWKS URI |
| --- | --- | --- | --- |
| `2.0` | `https://login.microsoftonline.com/TENANT_ID/v2.0` | API **Application (client) ID**, a GUID | `https://login.microsoftonline.com/TENANT_ID/discovery/v2.0/keys` |
| `1.0` | `https://sts.windows.net/TENANT_ID/` (including the trailing slash) | API App ID URI **or API client ID**, depending on how the token was requested | `https://login.microsoftonline.com/TENANT_ID/discovery/keys` |

The v2 metadata endpoint is `https://login.microsoftonline.com/TENANT_ID/v2.0/.well-known/openid-configuration`; v1 omits `/v2.0`. A v2 client can request `api://API_CLIENT_ID/Reports.Read`, but the resulting v2 access token's `aud` is the API GUID, **not** `api://API_CLIENT_ID`. For v1, pin the actual documented audience for your API; accept an explicit list only if you intentionally support both forms for that same API. Never substitute the frontend client ID, Microsoft Graph's audience, `common`, or `organizations`.

Microsoft's [v1 discovery document](https://login.microsoftonline.com/common/.well-known/openid-configuration) shows the `https://sts.windows.net/{tenantid}/` issuer template; resolve it to your pinned tenant GUID, rather than trusting arbitrary tenants. These forms follow Microsoft's [access-token claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference), [access-token version and validation guidance](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens), and [OpenID metadata reference](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc#fetch-the-openid-configuration-document). Sovereign clouds and applications with custom signing keys need their own verified metadata; this recipe does not cover them. Arc does not perform OIDC discovery or tenant-independent signing-key issuer validation for you.

## Configure the API

Set `ENTRA_TENANT_ID` and `ENTRA_API_CLIENT_ID` to the directory GUID and **API** application GUID. Add this entry point to the project, compile it with the project's TypeScript build, then run its emitted JavaScript with Node. It binds to loopback on port 3000; expose it only through your HTTPS ingress.

```typescript title="main.ts"
import { ArcServer, defineQuery, jwtBearer, runArc } from '@cratis/arc.core';
import { z } from 'zod';

const tenant = z.string().uuid().parse(process.env.ENTRA_TENANT_ID);
const audience = z.string().uuid().parse(process.env.ENTRA_API_CLIENT_ID);
const server = new ArcServer({
    authentication: [jwtBearer({
        issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
        jwksUrl: new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`),
        audience,
        algorithms: ['RS256']
    })],
    authorizationPolicies: {
        ReportsRead: principal => {
            const claims = principal.claims as Record<string, unknown> | undefined;
            return typeof claims?.scp === 'string' && claims.scp.split(' ').includes('Reports.Read');
        }
    },
    queries: [
        defineQuery({ name: 'RoleReports', schema: z.object({}),
            authorization: { roles: ['Reports.Read'] }, perform: () => 'role granted' }),
        defineQuery({ name: 'ScopeReports', schema: z.object({}),
            authorization: { policy: 'ReportsRead', authenticated: true }, perform: () => 'scope granted' })
    ],
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

`RS256` is an explicit asymmetric allowlist, not an algorithm read from an untrusted token. `jwtBearer()` rejects unsigned and symmetric algorithms in configuration, verifies signatures using the pinned HTTPS JWKS, checks issuer, audience, expiration and any not-before claim, and requires a nonempty subject. Clock tolerance defaults to zero. Key-fetch failure rejects the credential rather than allowing access. See [authentication options](../core/authentication.md#verify-jwt-bearer-tokens).

For v1 tokens, change **all three** issuer, JWKS URI and audience settings to the v1 row above. Choose one token contract per configuration. Two default `jwtBearer()` handlers do not implement fallback between issuers: a recognized but invalid Bearer token stops the handler chain.

## Access tokens are not ID tokens

Send the API access token as `Authorization: Bearer <access-token>`. An ID token establishes a client application's sign-in session; it is not an API credential. Microsoft documents that an [ID token's audience is the client application ID](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference). Separate API and frontend registrations let the API reject the frontend's ID token by audience, even when issuer, signing key and role names match.

**Signature verification alone cannot distinguish them.** Both token kinds can have `typ: JWT`, and ID tokens can contain `roles`. `jwtBearer()` is a generic verifier, not an Entra token-purpose detector: if you reuse the same registration/audience for the client and API, it can accept an otherwise valid ID token. Do not rely on `typ`, the presence of `roles`, or a nonce heuristic to prevent that confusion. Keep the registrations separate and require the intended permission on each operation.

## Keep app roles and scopes separate

- `roles` is an array. Entra uses it for assigned user app roles and for application permissions in app-only tokens. Arc maps it directly to `principal.roles`; `@roles('Reports.Read')` or the role requirement above checks that list. A role does not prove that the caller is a human.
- `scp` is a space-separated string of **delegated** scopes. Arc leaves it in `principal.claims`; it does not promote scopes to roles. `ReportsRead` requires the exact scope token, not a substring. With decorators, select the same policy using `@authorize('ReportsRead')`.
- Role-only and scope-only operations in this example are alternatives. If an operation must require both, declare both requirements; see [authorization policies](../core/authorization.md). Application-specific client allowlists or ownership rules are additional checks, not implied by an API audience.

`jwtBearer()` sets `principal.id` from `sub`, a pairwise identifier, not `oid`. For durable Entra directory relationships shared across services, use verified `tid` plus `oid`; do not key users by email or display name. See [durable identity keys](authproxy-easyauth.md#choose-a-durable-user-key).

## Check the result

Issue GET requests with the authorization header to the following paths:

| Credential | `/.cratis/me` | `/api/role-reports` | `/api/scope-reports` |
| --- | --- | --- | --- |
| Valid API token, `roles: ["Reports.Read"]`, no `scp` | 200, subject/name/roles and greeting | 200 | 403 |
| Valid API token, `scp: "Reports.Read"`, no roles | 200, empty roles and greeting | 403 | 200 |
| Wrong issuer or audience, expired token, or the separate frontend's ID token | 401 | 401 | 401 |
| Only the `.cratis-identity` cookie from a successful call | 401 | 401 | 401 |

The cookie is display data, never a credential. Identity enrichment runs only **after** authentication and cannot establish a principal. The repository's `Source/Core/authentication/for_identityRecipes` specs exercise these boundaries with locally generated signing keys and an intercepted JWKS response; they do not contact Entra or validate your tenant's deployment.

For live queries, continue with [observable transport authentication](observable-authentication.md), not named authentication schemes.
