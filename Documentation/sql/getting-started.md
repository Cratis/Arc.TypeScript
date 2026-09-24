---
title: Get started with SQL
---

For a first SQL-backed Arc query, install `drizzle-orm` and a Drizzle-supported database driver alongside `@cratis/arc.core` and `@cratis/arc.drizzle` from this source workspace. The linked SQLite specs use `sql.js` (WebAssembly, no native build); PostgreSQL integration checks use `pg` and `postgres`. Packages are not published to npm. Run your schema migration before serving requests; `addDrizzle` never creates tables.

The executable SQLite spec defines a [`tasks` table and connection](../../Source/Drizzle/for_DrizzleReadModels/given/a_sqlite_database.ts), a [`TaskRecord`](../../Source/Drizzle/for_DrizzleReadModels/given/TaskRecord.ts) with Fundamentals field metadata and a [model-bound query](../../Source/Drizzle/for_DrizzleReadModels/given/TaskQueries.ts). The host [registers them with `addDrizzle`](../../Source/Drizzle/for_DrizzleReadModels/when_serving_a_sqlite_page/with_each_http_adapter.ts), and the spec calls the generated `/page` route through Express, Fastify, and Hono. Run `yarn vitest run --project @cratis/arc.drizzle`; each adapter returns one sorted task and `paging.totalItems: 2`, while an unknown sort field returns HTTP 400.

Resolve the tenant in your Arc host before making SQL queries. For a single-tenant example, construct the builder with `ArcApplication.createBuilder({ resolveTenant: () => 'default' })`; without a tenant, SQL access fails with “A tenant is required for Drizzle access.” Registration then follows this shape:

```typescript
builder.add(TaskQueries).addDrizzle({
    dialect: 'sqlite',
    database: db,
    readModels: [{ type: TaskRecord, table: tasks }]
});
```

Here `db` is your Drizzle database and `tasks` is its declared table. This fragment belongs in an existing Arc application builder; follow the linked spec for imports, connection creation and serving requests. The plain `addDrizzle(builder, options)` function is equivalent. The single `database` option accepts **only** the `default` tenant; configure `databaseFactory(tenant, context)` before serving other tenants. Arc scopes the handle but does not close your pool or connection. Close it after disposing the application.

Commands can inject `service(drizzleDatabase<YourDatabaseType>())` and access the scoped handle's `.native`; query methods should use `service(drizzleReadModel(TaskRecord))` to avoid accidentally writing from a read model. Core on this branch has no read-model-for-command resolution hook. A command may explicitly inject `drizzleReadModel(TaskRecord)` for a read, but automatic resolution by command key is not available; the token is the seam for a future resolver. [Tenant routing](tenancy.md) explains what you must own.
