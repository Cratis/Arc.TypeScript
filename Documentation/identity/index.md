---
title: Identity
description: Give the frontend the current user's name, roles, and application details through /.cratis/me, and understand why the identity cookie is display data only.
---

A frontend wants to show "Hello, Ada" and hide buttons Ada cannot use, without calling a separate user service. Arc's identity endpoint returns the authenticated caller together with details your application adds, and sets a cookie the published `@cratis/arc` client reads.

## Provide identity details

Write a provider class and add or discover it with the builder:

```typescript
import { field } from '@cratis/fundamentals';
import {
    ArcApplication, identityDetailsProvider,
    type ExecutionContext, type IdentityDetailsProvider, type Principal
} from '@cratis/arc.core';

export class UserDetails {
    @field(String) greeting!: string;
}

@identityDetailsProvider()
export class GreetingDetails implements IdentityDetailsProvider {
    readonly detailsType = UserDetails;

    provide(principal: Principal, context: ExecutionContext): UserDetails {
        return { greeting: `Hello ${principal.name ?? principal.id} (${context.tenantId ?? 'no tenant'})` };
    }
}
```

With a verified [authentication handler](../core/authentication.md) that recognizes Ada, `GET /.cratis/me` answers:

```json
{"id":"ada","name":"Ada","isAuthenticated":true,"isAuthorized":true,"roles":["reader"],"details":{"greeting":"Hello Ada (no tenant)"}}
```

and sets `.cratis-identity=<base64>; Path=/; SameSite=Lax`, with `Secure` when the trusted transport is HTTPS.

The provider declares its details shape either as `detailsType`, a class with `@field` declarations, or as a Zod `schema`. The details returned by `provide` must match it.

## Choose how to register the provider

- A class marked `@identityDetailsProvider()`, added with `builder.add(...)` or found by `builder.discover(...)`. Arc constructs one per request, so its constructor must take no arguments; unlike .NET, there is no constructor injection here.
- An object in the `identityDetails` option: `{ schema, provide }` or `{ detailsType, provide }`. An explicit option wins, and cannot be combined with a discovered provider.
- More than one discovered provider without an explicit option fails at build.

## The endpoint's answers

| Situation | `GET /.cratis/me` |
| --- | --- |
| No provider configured | Not mapped |
| Anonymous caller | 401 |
| `provide` returns `undefined` | 403 |
| `provide` throws or rejects, or the encoded cookie would exceed 4096 bytes | Generic 500, no cookie |
| Otherwise | 200 with the identity JSON and the cookie |

Every answer carries `Cache-Control: no-store`. The provider runs in the current execution context with its own scoped services, even on denial or error. `GET /.cratis/identity-details/schema` returns the details JSON Schema; see [Introspection](../introspection/identity-details-schema.md).

The JSON response keeps Unicode. The cookie escapes non-ASCII characters before Base64 encoding, so the client's `JSON.parse(atob(cookie))` recovers names and details, including emoji. Cookie bytes are not guaranteed to match .NET's JSON escaping.

:::danger[The identity cookie is not a credential]
`.cratis-identity` is unsigned and readable by JavaScript. It exists so the frontend can display the user. Never use it to authenticate or authorize anything; Arc itself never does.
:::

## Related

- [Development users and tenants](development-users-and-tenants.md)
- [Authentication](../core/authentication.md)
- [Frontend identity](/arc/frontend/) on the shared Arc pages
