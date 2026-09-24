---
title: Migrate a Drizzle schema
description: Own your SQL schema with drizzle-kit migrations, run them before Arc starts, and migrate every tenant deliberately.
---

Own the schema in the application and use [drizzle-kit](https://orm.drizzle.team/docs/drizzle-kit-overview) to generate and apply SQL migrations. Run migrations **before** starting Arc or admitting tenant requests. `addDrizzle` does not discover migrations, create tables or add columns at runtime.

For a new column, add it to your Drizzle table declaration, generate a migration with drizzle-kit, inspect the generated SQL, and apply it with your deployment's migration step. A non-nullable column on a populated table may need a default or a staged backfill. Review provider-specific SQL and test the result against existing data before deployment. There is no TypeScript counterpart to .NET's `AddStringColumn` / `AddJsonColumn` EF migration extensions; use the [column codecs](column-types.md) in the declared schema and drizzle-kit in the migration workflow instead of maintaining a second migration engine.

With per-tenant databases or schemas, migrate **each authorized tenant target** deliberately; a successful migration on the default tenant does not prove the others are ready. Do not run uncontrolled schema changes in `databaseFactory`.
