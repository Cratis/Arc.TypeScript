---
title: Development users and tenants
description: Offer fixture users and tenants to local development tooling through /.cratis/users and /.cratis/tenants, and keep them out of production.
---

Local development tools, such as a user or tenant picker, need something to pick from. Hard-coding that list in the tool means it drifts from your application. Arc serves two anonymous discovery routes instead, which return nothing until you opt in with fixture data from your own code.

## Opt in

```typescript
const builder = ArcApplication.createBuilder({
    development: true,
    developmentUsers: () => [{
        microsoftIdentity: {
            identityProvider: 'development',
            userId: 'ada',
            userDetails: 'Ada',
            userRoles: ['editor'],
            claims: [{ typ: 'tenants', val: 'acme' }]
        }
    }],
    developmentTenants: () => [{ id: 'acme', name: 'Acme' }]
});
```

`GET /.cratis/users` and `GET /.cratis/tenants` return `[]` until you set `development: true` and supply `developmentUsers(context)` or `developmentTenants(context)`. Each option takes a provider function, a promise-returning function, or an array of them; results are aggregated in order.

| Route | Entry shape |
| --- | --- |
| `/.cratis/users` | `{ microsoftIdentity: { identityProvider, userId, userDetails, userRoles, claims: [{ typ, val }] }, details? }` |
| `/.cratis/tenants` | `{ id, name }` |

Results are capped at 100 entries and 32 KiB, keep provider order and duplicates, and an invalid or failing provider answers a generic 500. Each request gets its own service scope.

:::danger[Fixtures only]
Both routes are anonymous. Never return secrets, production user inventories, or real tenant memberships. A development user entry is not a credential and does not authenticate anyone.
:::

Tenant resolution is separate: listing a tenant here does not select or authorize it. See [Tenancy](../tenancy/index.md).

:::caution[Tenancy rules apply to these routes too]
The discovery routes resolve a tenant like every other request. With `tenancy.required`, an anonymous request without a tenant answers 400. With `tenancy.membershipClaim`, a request that names a tenant answers 403, because an anonymous caller has no membership claim. Leave `required` off in the local configuration that serves a picker.
:::

## What a picker does with the list

A tool such as [Lens](/tools/lens/) reads both routes to fill its pickers, then sends identity and tenant headers with your application's requests. Arc only turns those identity headers into a principal when you registered `microsoftIdentityPlatform()`. [Simulate a signed-in user locally](local-development.md) shows that setup on a loopback host.

## Related

- [Identity](index.md)
- [Simulate a signed-in user locally](local-development.md)
- [Tenant resolvers](../tenancy/resolvers.md)
