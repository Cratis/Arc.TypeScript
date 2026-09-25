---
title: MongoDB tenancy
description: How withMongoDB chooses a database and server for each tenant, and what a single-tenant application configures.
---

Every Arc execution resolves a tenant, and the MongoDB collection you inject belongs to that tenant's database. You decide the mapping; the package never falls back to a default database silently.

## Database per tenant

| Configuration | Tenant `default` | Tenant `acme` |
| --- | --- | --- |
| `database: 'tasks'` | `tasks` | `tasks+acme` |
| `databaseNameResolver: tenant => \`tasks_${tenant}\`` | `tasks_default` | `tasks_acme` |

Tenant names are normalized to lowercase before a database is chosen, including names returned by `resolveTenant`. A missing tenant or an empty database name fails the request.

## Server per tenant

`serverResolver(tenantId, context)` routes tenants to different MongoDB servers and must return a URI. It replaces `client` and `server`.

## Single-tenant applications

Configure Arc tenancy with a fixed tenant of `default`:

```typescript
const builder = ArcApplication.createBuilder({ tenancy: { sources: ['fixed'], fixed: 'default' } });
```

With `database: 'tasks'`, every request then uses the bare `tasks` database.

## Isolation is not authorization

Choosing the tenant's database does not prove the caller belongs to that tenant. Configure a membership check or derive the tenant from the principal; see [Tenancy](../tenancy/index.md).

## Related

- [Get started with MongoDB](getting-started.md)
- [Tenant resolvers](../tenancy/resolvers.md)
