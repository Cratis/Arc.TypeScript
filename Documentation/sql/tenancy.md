---
title: Route SQL by tenant
description: Give each tenant its own SQL database with databaseFactory, keep single-tenant applications on the default tenant, and own the pools, credentials, and isolation checks.
---

Two customers share your service, and neither may ever see the other's tasks. The safest line between them is a database each. With `databaseFactory`, every request's tenant selects the database its queries and commands use, and no query can ask for another tenant's data.

## A database per tenant

```typescript
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DrizzleDialect } from '@cratis/arc.drizzle';
import { TaskRecord, tasks } from './Tasks.js';

const databases = new Map<string, NodePgDatabase>();
const allowedTenants = new Set(['acme', 'globex']);

builder.withDrizzle({
    dialect: DrizzleDialect.PostgreSQL,
    databaseFactory: tenant => {
        if (!allowedTenants.has(tenant)) throw new Error(`Unknown tenant ${tenant}`);
        let database = databases.get(tenant);
        if (!database) {
            database = drizzle(new Pool({ connectionString: `postgres://localhost/tasks_${tenant}` }));
            databases.set(tenant, database);
        }
        return database;
    },
    readModels: [{ type: TaskRecord, table: tasks }]
});
```

This excerpt assumes an Arc `builder` and a PostgreSQL `tasks` table declared with `pgTable`, in the shape [Get started](getting-started.md) shows for SQLite. Arc calls `databaseFactory` once per execution scope, after it has resolved the tenant, with the tenant ID in lowercase. A missing tenant, or a factory that returns nothing, fails the request.

## What you own

Arc selects; your factory decides. The application owns:

- **Creation and caching.** Reuse one pool per tenant, as above. A factory that creates a pool for any tenant ID a request names lets a caller exhaust your connections.
- **The mapping.** Arc does not check that the database you return belongs to the tenant, and does not add a tenant predicate to any query.
- **Credentials.** Give each tenant's pool credentials that reach only that tenant's database.
- **Shutdown.** Arc never closes a database the factory returns. Close your pools after `await app.dispose()`.
- **Migrations.** Migrate every tenant's database before serving it; see [Own the schema](getting-started.md#own-the-schema).

Choosing the tenant's database does not prove the caller belongs to that tenant. Configure a membership check or derive the tenant from the principal; see [Tenancy](../tenancy/index.md).

## A schema per tenant

For one database with a schema per tenant, return a pool or connection that is already confined to that tenant's schema, such as one with a fixed search path. Never change the search path of a shared pooled connection per request unless a transaction guarantees it is reset.

## Single-tenant applications

The `database` option is the short path for one database. It serves only the `default` tenant, and a request for any other tenant fails closed with `Drizzle database is only available for the default tenant`. Resolve every request to that tenant:

```typescript
const builder = ArcApplication.createBuilder({ tenancy: { resolve: () => 'default' } });
```

Set exactly one of `database` and `databaseFactory`; both, or neither, fails `withDrizzle`.

## Verify the boundary

Test cross-tenant reads and writes with your real pool configuration and authorization: read as one tenant, write as another, and check that nothing crosses. The package's [SQLite tenant-isolation spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Drizzle/for_DrizzleReadModels/when_paging_across_tenants/with_sqlite.ts) shows the shape of such a check. The [MySQL 8.4 integration spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Drizzle/for_DrizzleReadModels/when_reading/with_mysql.integration.ts) uses two physical databases and verifies that `databaseFactory` routes reads to the current tenant; it does not test authorization or cross-tenant writes.

.NET EF pooled contexts do not infer a database per tenant either. This integration makes the choice explicit, like the MongoDB integration's per-tenant resolvers, rather than reusing one pool across tenants.

## Related

- [Tenancy](../tenancy/index.md)
- [Get started with SQL](getting-started.md)
