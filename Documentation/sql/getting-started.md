---
title: Get started with SQL
description: Declare a Drizzle table and an Arc read model, serve a paged query with withDrizzle, write from a command, and keep queries on the read-only handle.
---

This page serves a SQL table through an Arc query. It uses SQLite through `sql.js`, which runs in WebAssembly and needs no native build, so you can follow it on any machine. The code follows the package's [SQLite fixture](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Drizzle/for_DrizzleReadModels/given/a_sqlite_database.ts). PostgreSQL and MySQL use their respective Drizzle drivers; the live integration runs PostgreSQL 16 and MySQL 8.4 with `mysql2`. For MySQL tables using `dateOnlyCodec`, create the `mysql2` pool with `dateStrings: true` (for example, `createPool({ uri, dateStrings: true })`). Without it, `DATE` values arrive as JavaScript `Date` objects, which `dateOnlyCodec` cannot parse.

Install `drizzle-orm` 0.45 and a Drizzle driver, here `sql.js`, next to `@cratis/arc.core` and `@cratis/arc.drizzle`. The Arc packages are not published to npm: install tarballs packed from a clone, or work inside the clone's workspace, as [Create an application](../getting-started/create-an-application.md) shows.

## Declare the table and the model

The Drizzle table describes the storage. The Arc read model describes what a query returns.

```typescript title="Tasks.ts"
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
import { DrizzleDialect, guidCodec, sqliteColumn } from '@cratis/arc.drizzle';

export const tasks = sqliteTable('tasks', {
    id: sqliteColumn(guidCodec(DrizzleDialect.SQLite))('id').primaryKey(),
    title: text('title').notNull()
});

export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
}
```

Every `@field` on the model needs a column with the same property name, and the table needs a primary-key column; registration fails otherwise. `sqliteColumn(guidCodec(DrizzleDialect.SQLite))` stores the `Guid` as text and reads it back as a `Guid`. [Column types](column-types.md) lists the other codecs.

## Serve a query

```typescript title="TaskQueries.ts"
import { query, queryOptions, readModel, service, type QueryOptions } from '@cratis/arc.core';
import { drizzleReadModel, type DrizzleReadModels } from '@cratis/arc.drizzle';
import { TaskRecord } from './Tasks.js';

@readModel()
export class TaskQueries {
    @query(service(drizzleReadModel(TaskRecord)), queryOptions())
    static page(tasks: DrizzleReadModels<TaskRecord>, options: QueryOptions) {
        return tasks.queryPage(undefined, options);
    }
}
```

`drizzleReadModel(TaskRecord)` is a service token for a read-only handle on the current tenant's database. `queryPage` pushes the count, sort, limit, and offset into SQL; see [Paging and sorting](paging.md).

## Register the database

```typescript title="main.ts"
import initSqlJs from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { ArcApplication } from '@cratis/arc.core';
import { DrizzleDialect } from '@cratis/arc.drizzle';
import { TaskRecord, tasks } from './Tasks.js';
import { TaskQueries } from './TaskQueries.js';

const SQL = await initSqlJs();
const native = new SQL.Database();
native.run('create table tasks (id text primary key, title text not null)');
const database = drizzle(native);

const builder = ArcApplication.createBuilder({ tenancy: { resolve: () => 'default' } });
builder.add(TaskQueries).withDrizzle({
    dialect: DrizzleDialect.SQLite,
    database,
    readModels: [{ type: TaskRecord, table: tasks }]
});
const app = await builder.build();
await app.run();
```

Importing `@cratis/arc.drizzle` adds `withDrizzle` to the builder; the exported `withDrizzle(builder, options)` function is equivalent. A GET on the `page` query's route with `pageSize=10&sortBy=title` answers with up to ten tasks sorted by title, and `paging.totalItems` counted in SQL. An unknown sort field answers 400.

`tenancy.resolve` makes every request use the `default` tenant, the only tenant the single `database` option serves. Without a tenant, SQL access fails with `A tenant is required for Drizzle access`. For more than one tenant, see [Tenancy](tenancy.md).

The `create table` statement stands in for a migration so the example is self-contained. `withDrizzle` never creates or changes tables; see [Own the schema](#own-the-schema).

## Write from a command

A command that writes takes the writable database handle:

```typescript title="AddTask.ts"
import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { field, Guid } from '@cratis/fundamentals';
import { command, inject, key } from '@cratis/arc.core';
import { drizzleDatabase, type DrizzleHandle } from '@cratis/arc.drizzle';
import { tasks } from './Tasks.js';

@command()
export class AddTask {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;

    @inject(drizzleDatabase<SQLJsDatabase>())
    handle(database: DrizzleHandle<SQLJsDatabase>): void {
        database.native.insert(tasks).values({ id: this.id, title: this.title }).run();
    }
}
```

`drizzleDatabase<T>()` resolves to a `DrizzleHandle` whose `native` property is the tenant's Drizzle database, typed as you declare it. Register `AddTask` with `builder.add(...)` like the query.

## Load a read model in a command

A command can receive the row whose single primary key matches its `@key()` value. This one renames a task and answers with the title it had before:

```typescript title="RenameTask.ts"
import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { eq } from 'drizzle-orm';
import { field, Guid } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key } from '@cratis/arc.core';
import { drizzleDatabase, type DrizzleHandle } from '@cratis/arc.drizzle';
import { TaskRecord, tasks } from './Tasks.js';

@command()
export class RenameTask {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;

    @inject(commandReadModel(TaskRecord), drizzleDatabase<SQLJsDatabase>())
    handle(task: TaskRecord, database: DrizzleHandle<SQLJsDatabase>): string {
        database.native.update(tasks).set({ title: this.title }).where(eq(tasks.id, this.id)).run();
        return task.title;
    }
}
```

Register `RenameTask` with `builder.add(...)` before `build()`, alongside the SQL model in `withDrizzle.readModels`. Drizzle supplies the command's `TaskRecord` from the current tenant database, and a missing row rejects the command with a validation failure before `handle()` runs. The key is validated against its model field: Arc codec (custom) columns bind a typed `Guid` or concept for Drizzle to encode; plain text, integer, or UUID columns bind the underlying primitive (a GUID string or concept value). Malformed GUID and integer keys fail before SQL comparison.

To record the rename as an event instead of writing the row, return an event from `handle()` and register [Chronicle](../chronicle/add-event-sourcing.md), which appends it; see [Returning events](../chronicle/commands/index.md). Drizzle never appends events. Do not register `TaskRecord` as a Chronicle read model as well: injecting it with `commandReadModel` fails at build because two resolvers claim it.

Command read-model injection needs exactly one column with `.primaryKey()`, and that column must be declared as an Arc `@field` on the model. Without either, the model can still serve queries, but a command injecting it fails at build with "Expected one read-model resolver for ModelName, found 0". A table-level `primaryKey({ columns })` is not recognized for this purpose; several column-level primary keys can serve queries but cannot resolve a command's single key. Command read models are tested against SQLite and live MySQL 8.4; PostgreSQL integration tests cover queries, not command injection.

## Keep queries read-only

Queries take `drizzleReadModel(Model)`, commands take `drizzleDatabase()`. The read handle, `DrizzleReadModels<Model>`, exposes:

| Member | Returns |
| --- | --- |
| `queryPage(filter, options)` | One page with the total, counted and cut in SQL |
| `find(filter, sorting?)` | Every match, or throws when there are more than `maxPageSize` |
| `findOne(filter)` | The first match in primary-key order, or `undefined` |
| `findById(key)` | The row matching the single primary key, or `null` |
| `table` | The Drizzle table |

It has no write methods and does not expose the writable database. A filter is a Drizzle `SQL` expression such as `eq(tasks.title, 'a')`, built with bound parameters; never interpolate request input into SQL text.

This is an API boundary, **not** a database permission. Any code can still inject the writable token, and JavaScript can reach past TypeScript visibility. When queries must not be able to write, give them a connection with read-only database credentials.

None of these methods accept a cancellation signal, and Arc does not pass the request's signal to the driver. Set timeouts in the driver or the database.

## Own the schema

Your application owns the schema and its migrations; Arc has no migration engine. Use [drizzle-kit](https://orm.drizzle.team/docs/drizzle-kit-overview) to generate SQL migrations from the table declarations, review the generated SQL, and apply it in your deployment **before** Arc starts serving requests.

- A new non-nullable column on a populated table needs a default or a staged backfill.
- With a database per tenant, migrate **every** tenant's database. A migration that succeeded on one tenant proves nothing about the others.
- Do not run schema changes from `databaseFactory`; it runs on requests.

There is no TypeScript counterpart of .NET's `AddStringColumn` and `AddJsonColumn` EF migration helpers. Declare column types with the [column codecs](column-types.md) and let drizzle-kit generate the SQL.

## Own the connection

Arc wraps the database you register in a scoped handle for each request, and never closes it. Close the connection or pool yourself, after `await app.dispose()`.

## Related

- [Column types](column-types.md)
- [Paging and sorting](paging.md)
- [Tenancy](tenancy.md)
