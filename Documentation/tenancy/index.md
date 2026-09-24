---
title: Tenancy
description: Choose how Arc selects a tenant for each request, read it anywhere in the request, and keep tenant selection separate from proving membership.
---

A multi-tenant application must never serve one customer's data to another. Arc resolves a tenant for every request and makes it available to your commands, queries, and storage integrations. Resolving a tenant is not the same as proving the caller belongs to it, and this page shows where each happens.

## Three ways to select a tenant

| Configuration | Behavior |
| --- | --- |
| Nothing | Arc reads the `x-cratis-tenant-id` header unchanged; `tenantHeader` renames it. Missing header means `tenantId` is `undefined` |
| `resolveTenant(request, principal)` | Your resolver alone decides, after authentication, and may be `async`. Returning `undefined` means no tenant; there is no fallback |
| `tenancy: { sources: [...] }` | Ordered built-in sources with optional `required` and membership checks; see [Tenant resolvers](resolvers.md) |

`resolveTenant` overrides `tenancy`.

```typescript
const builder = ArcApplication.createBuilder({
    authentication: [/* verified handlers */],
    tenancy: { sources: ['claim', 'header'], claimType: 'tenant', membershipClaim: 'tenants', required: true }
});
```

This tries an own `tenant` claim on the verified principal first, then the header. A missing tenant answers 400; a selected tenant that is not listed in the principal's comma-separated `tenants` claim answers 403.

:::danger[A header is a request, not proof]
Without `tenancy.membershipClaim` or `resolveTenant`, Arc takes the header unchanged and does not check membership. When tenants separate customers' data, derive the tenant from the principal in `resolveTenant`, configure a membership claim, or check it in authorization. Never enforce it in a validator: a trusted direct caller can lower blocking severity.
:::

## Read the tenant

Every callback receives the execution context with `tenantId`, `principal`, `correlationId`, `signal`, and `allowedSeverity`. Code without access to that parameter, such as a repository deep in a call chain, can call `currentContext()`. It uses Node.js `AsyncLocalStorage`, so concurrent requests never see each other's context, and it returns `undefined` outside an Arc execution.

## Storage follows the tenant

The storage integrations select per-tenant storage from the resolved tenant, and fail when there is none:

- [MongoDB](../mongodb/tenancy.md) chooses a database per tenant.
- [SQL with Drizzle](../sql/tenancy.md) calls your `databaseFactory` per tenant.
- [Chronicle](../chronicle/index.md) appends in the tenant's namespace.

Storage isolation does not replace authorization: verify the caller may use the tenant before the query runs.

## Related

- [Tenant resolvers](resolvers.md)
- [Development users and tenants](../identity/development-users-and-tenants.md)
