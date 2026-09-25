---
title: SQL with Drizzle
description: Serve model-bound queries from application-owned Drizzle databases on SQLite and PostgreSQL, and know what the integration deliberately leaves to you.
---

`@cratis/arc.drizzle` connects Arc queries to application-owned Drizzle databases. It supports SQLite and PostgreSQL with executable database checks; MySQL uses the same SQL query path but has **not** been exercised against a live MySQL server. This is a source preview, not a published npm package.

Use [Get started](getting-started.md) to wire one SQLite database into an Arc read model. Then choose [column conversions](column-types.md), [tenant routing](tenancy.md), [read-only access](read-only.md), [paging and sorting](paging.md), or [migrations](migrations.md). [Observation](observing.md) describes the unsupported live-query boundary.

Drizzle's typed, SQL-first schema and query builders let Arc share one read path across PostgreSQL, MySQL, and SQLite while your application retains its SQL and migration ownership. Kysely is a capable typed query builder but does not supply the same table/column mapping used here; Prisma emphasizes its own schema, client generation and migration workflow; TypeORM centers on entities, decorators and unit-of-work patterns rather than this explicit, read-only handle. These are trade-offs, not claims that one ORM replaces another.

Drizzle 0.45.x is pre-1.0 (1.0 is in beta). The peer dependency `^0.45.0` accepts compatible 0.45.x releases, **not** 0.46.x or 1.0; test and update this integration before changing the range. There is no Chronicle requirement or EF Core change tracker. Arc's .NET EF integration also offers SQL Server, spatial Point/LineString/Polygon types, multiple DbContexts and `BaseDbContext` automatic concept conversion; none of those features are ported here. Only one Drizzle database token can be registered per application; adding another `withDrizzle` registration fails at build with a duplicate service. Multiple tenants instead use `databaseFactory` to select one database per tenant.
