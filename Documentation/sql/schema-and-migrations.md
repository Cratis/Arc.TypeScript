---
title: Map the schema and own migrations
description: Map Arc read-model fields to Drizzle table columns and codecs, generate and apply migrations with drizzle-kit in your host, order schema and code changes safely, and choose database credentials for reads, writes, and migrations.
---

Your `TaskRecord` gains a due date. Three things have to change together: the Drizzle table, the Arc read model, and the database itself. Arc checks the first two against each other when the application starts, and never touches the third. This page shows how the mapping works, how to change the database with drizzle-kit, and which credentials each part needs.

## How fields map to columns

Arc matches each `@field` on the read model to the table column with the **same property key** in the Drizzle table object. The SQL column name is yours to choose:

```typescript title="Features/Tasks/Tasks.ts"
import { pgTable, text } from 'drizzle-orm/pg-core';
import { field, DateOnly, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
import { dateOnlyCodec, DrizzleDialect, guidCodec, pgColumn } from '@cratis/arc.drizzle';

export const tasks = pgTable('tasks', {
    id: pgColumn(guidCodec(DrizzleDialect.PostgreSQL))('id').primaryKey(),
    title: text('title').notNull(),
    dueOn: pgColumn(dateOnlyCodec)('due_on'),
    createdBy: text('created_by')
});

export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
    @field(DateOnly) dueOn!: DateOnly | null;
}
```

- `dueOn` maps to the `due_on` column, because the table object's key is `dueOn`.
- `createdBy` is in the table but not on the model. Arc never selects it, so a query never returns it.
- Arc always selects primary-key columns, and uses them to order `findOne` and to resolve a command's read model by key.

When you register `{ type: TaskRecord, table: tasks }` in `withDrizzle`, Arc checks that the model has `@field` metadata and that every field has a column with its key. A missing column fails with `Drizzle model TaskRecord has no column for field: dueOn`, before the application serves a request. Arc checks the table declaration, not the database, so a column declared in TypeScript but missing in the database fails when a query runs.

## Columns and codecs

A codec column converts between your type and the driver's value on every read and write. A plain Drizzle column passes the driver value through, and Arc converts it to the field's type on reads only:

| Column | Reads | Writes |
| --- | --- | --- |
| `pgColumn(codec)`, `mysqlColumn(codec)`, `sqliteColumn(codec)` | The codec's `fromDriver`, typed as your value | The codec's `toDriver`, from your value |
| A plain `text`, `integer`, `uuid`, ... column | Arc rebuilds `Guid`, concepts, `DateOnly`, `TimeOnly`, and `TimeSpan` from the driver value | You pass the driver's type, such as a GUID string |

Prefer a codec wherever a field is not a plain string, number, or boolean. [Column types and conversions](column-types.md) lists the built-in codecs and their SQL types per dialect.

A codec is an object implementing `ColumnCodec<T, Driver>` from `@cratis/arc.drizzle`:

| Member | Meaning |
| --- | --- |
| `sqlType` | The SQL type written into the column declaration, such as `uuid` or `text` |
| `toDriver(value)` | Converts your value to what the driver sends |
| `fromDriver(value)` | Converts what the driver returns to your value |

You can implement it for a type the built-in codecs do not cover and pass it to `pgColumn`, `mysqlColumn`, or `sqliteColumn`. On SQLite, `sqliteColumn` declares `date` and `time` codecs as `text`.

## Generate migrations with drizzle-kit

Your host owns the schema. `withDrizzle` never creates tables, adds columns, or runs migrations, and there is no migration step in Arc's startup. Use [drizzle-kit](https://orm.drizzle.team/docs/drizzle-kit-overview), which reads the same table declarations, including the SQL types your codecs declare:

```bash
npx drizzle-kit generate --dialect postgresql --schema ./Features/Tasks/Tasks.ts --out ./drizzle
```

Review the generated SQL before you commit it. drizzle-kit cannot know that a new `NOT NULL` column on a populated table needs a default or a backfill, or that a rename is not a drop and an add.

## Apply migrations before serving

Apply the migrations in your deployment, before the new version of the application starts. With a database per tenant, apply them to **every** tenant's database. Drizzle's `migrate()` function does this from a script you own:

```typescript title="scripts/migrate.ts"
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const tenants = ['acme', 'globex'];

for (const tenant of tenants) {
    const pool = new Pool({ connectionString: `postgres://migrator@localhost/tasks_${tenant}` });
    try {
        await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
    } finally {
        await pool.end();
    }
}
```

The script records applied migrations in each database, so running it again applies only new ones. Stop on the first failure and fix it: a migration that succeeded for Acme proves nothing about Globex.

Do not run migrations from `databaseFactory`. It runs on requests, concurrently, and under the application's credentials.

## Order schema and code changes

Because Arc selects only the fields a model declares, plus the primary-key columns, you can change the database and the code in separate deployments:

| Change | Order |
| --- | --- |
| Add a field | Migrate the column first, then deploy the code that declares it. Code that declares a column the database lacks fails its queries. |
| Remove a field | Deploy the code without the field first, then drop the column. |
| Rename a column or a field | Add the new column and backfill it, deploy the code that uses it, then drop the old column. Renaming only the SQL name keeps the model field, because the field follows the property key, but running code still selects the old name. |

With several instances, old and new code run against the same schema during a rollout, so keep each step compatible with the version before it.

## Database credentials

Arc gives queries a read-only handle, `DrizzleReadModels`, and commands the writable `drizzleDatabase()`. That separation is an API boundary for your code, not a permission: both resolve from the same database connection for the tenant, and any code can inject the writable token. Enforce the boundary in the database:

| Role | Needs | Used by |
| --- | --- | --- |
| Migration | Create and alter tables | Your migration script, in deployment |
| Application | Read, and write the tables your commands change | The pools you return from `database` or `databaseFactory` |
| Read-only application | Read only | The pools of a service whose commands do not write these tables |

Never give the application's credentials the right to change the schema. When a service only serves queries from these tables, register a pool with read-only credentials; a command that tries to write through it then fails in the database, whatever the code does.

## Related

- [Column types and conversions](column-types.md)
- [Get started with SQL](getting-started.md)
- [Route SQL by tenant](tenancy.md)
