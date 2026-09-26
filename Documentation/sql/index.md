---
title: SQL with Drizzle
description: Serve model-bound queries from application-owned Drizzle databases on SQLite, PostgreSQL, and MySQL, with SQL-side paging, column codecs, and tenant routing.
---

Your read models live in SQL tables. Every query needs the right database for the tenant, a page and a total count computed in SQL rather than in memory, sorting that a client cannot turn into SQL injection, and conversions for GUIDs, concepts, and dates. `@cratis/arc.drizzle` does that on top of [Drizzle](https://orm.drizzle.team), while your application keeps its schema, its migrations, and its connections.

:::caution[Source preview]
`@cratis/arc.drizzle` is not published to npm. SQLite runs in-process; PostgreSQL 16 and MySQL 8.4 are exercised against disposable live Docker databases. MySQL coverage includes tenant routing, codecs, paging, limits, sort rejection, and command read-model lookup. PostgreSQL command lookup is checked with node-postgres, including tenant routing, typed keys, and missing rows. This does not establish full parity with Arc on .NET. The [capability reference](../reference/capabilities.md#persistence-and-chronicle) has the status and the checks behind it.
:::

## What it provides

| Capability | Page |
| --- | --- |
| Register a database and read models with `withDrizzle`, serve a query, load a model by a command key, write from a command, and keep queries on a read-only handle | [Get started](getting-started.md) |
| Store GUIDs, concepts, dates, times, durations, and JSON per dialect | [Column types](column-types.md) |
| Count, sort, and page in SQL | [Paging and sorting](paging.md) |
| Announce writes and observe tenant-scoped SQL results in process (Experimental) | [Observe tables](observing-tables.md) |
| Route each tenant to its own database | [Tenancy](tenancy.md) |

## Why Drizzle

Drizzle's typed, SQL-first table declarations and query builders let Arc share one read path across PostgreSQL, MySQL, and SQLite, while your application keeps ownership of its SQL and its migrations. Kysely is a capable typed query builder but does not supply the table and column mapping used here. Prisma centers on its own schema, client generation, and migration workflow. TypeORM centers on entities, decorators, and a unit of work rather than an explicit read-only handle. These are trade-offs, not claims that one ORM replaces another.

Drizzle 0.45 is before 1.0. The peer dependency `^0.45.0` accepts 0.45 releases, **not** 0.46 or 1.0; the integration has to be tested and updated before that range changes.

## What it does not do

- **No schema management.** `withDrizzle` never creates tables, adds columns, or runs migrations. See [Own the schema](getting-started.md#own-the-schema).
- **Only announced in-process changes.** Opt-in `DrizzleObservation.InProcess` observes registered tables after explicit `notifyChanged` calls. Other processes and unannounced writes are invisible; host-owned outer transactions are not covered by the command completion boundary. Observed pages are eventually consistent, not atomic count-and-row snapshots. PostgreSQL `LISTEN`/`NOTIFY` is not included. See [Observe tables](observing-tables.md).
- **No transactions or change tracking.** There is no unit of work shared with command execution. Use a Drizzle transaction in your command when several writes must succeed together.
- **One registration per application.** A second `withDrizzle` fails at build with a duplicate service. Several tenants use one registration with `databaseFactory`.
- **No EF-only features.** Arc on .NET's Entity Framework integration also has SQL Server, spatial Point, LineString, and Polygon types, several DbContexts, and automatic concept conversion in `BaseDbContext`. None of those are part of this package.

Start with [Get started](getting-started.md).
