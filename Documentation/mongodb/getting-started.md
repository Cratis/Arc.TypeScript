---
title: Get started with MongoDB
description: Register a MongoDB client and read models with withMongoDB, inject a tenant-scoped collection into model-bound queries, configure the connection from appsettings.json, and own the client's lifetime.
---

This page connects one read model to MongoDB and serves it from three queries: a list, a page, and a live list. It follows the package's [replica-set integration fixture](https://github.com/Cratis/Arc.TypeScript/tree/main/Source/MongoDB/for_MongoCollection/given). You need a MongoDB server; the live query needs a replica set.

## Declare the model

```typescript title="TaskRecord.ts"
import { field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';

export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
}
```

The collection reads and writes only the fields you declare with `@field`. `@key()` marks the field stored as `_id`; without it, a field named `id` is used, and a model with neither is rejected.

## Inject the collection into queries

```typescript title="TaskQueries.ts"
import { query, queryOptions, readModel, service, type QueryOptions } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import { TaskRecord } from './TaskRecord.js';

const tasks = mongoCollection(TaskRecord);

@readModel()
export class TaskQueries {
    @query(service(tasks))
    static async all(items: MongoCollection<TaskRecord>): Promise<TaskRecord[]> {
        return items.find();
    }

    @query(service(tasks), queryOptions())
    static async page(items: MongoCollection<TaskRecord>, options: QueryOptions) {
        return items.queryPage({}, options);
    }

    @query({ observable: true }, service(tasks))
    static changes(items: MongoCollection<TaskRecord>) {
        return items.observe();
    }
}
```

`mongoCollection(TaskRecord)` is a service token. Each request resolves it to the collection in the current tenant's database, so a query never chooses a database itself. `all` returns every task, `page` pushes count, sort, and paging into MongoDB (see [Paging](paging.md)), and `changes` opens a change stream (see [Observing collections](observing-collections.md)).

For an owner-restricted query, build the filter from the verified principal, such as `items.find({ owner: principal.id })`, instead of forwarding a caller-provided object.

## Register MongoDB

```typescript title="main.ts"
import { ArcApplication, TenantResolverType } from '@cratis/arc.core';
import { MongoClient } from 'mongodb';
import '@cratis/arc.mongodb';
import { TaskRecord } from './TaskRecord.js';
import { TaskQueries } from './TaskQueries.js';

const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017');
const builder = ArcApplication.createBuilder({ tenancy: { resolverType: TenantResolverType.Fixed, fixedTenantId: 'default' } });
builder.add(TaskQueries).withMongoDB({
    client, databaseNameResolver: tenant => `tasks_${tenant}`, readModels: [TaskRecord]
});
const app = await builder.build();
await app.run();
await client.close();
```

Importing `@cratis/arc.mongodb` adds `withMongoDB` to the builder. The exported `withMongoDB(builder, options)` function is equivalent. List every model you inject in `readModels`; a model left out has no collection token.

The fixed `default` tenant makes this a single-tenant example, and every request uses the `tasks_default` database. See [Tenancy](tenancy.md) for real tenant routing.

A GET on the `all` query's route answers with the stored tasks. [Endpoint mapping](../core/endpoint-mapping.md) explains how routes are derived.

## Configure the connection in appsettings.json

`withMongoDB` reads `Cratis:MongoDB` from the application's [configuration](../configuration/index.md), so the server address and database can stay out of code:

```json title="appsettings.json"
{
  "Cratis": {
    "MongoDB": {
      "server": "mongodb://127.0.0.1:27017",
      "database": "tasks"
    }
  }
}
```

```typescript title="main.ts (excerpt)"
builder.add(TaskQueries).withMongoDB({ readModels: [TaskRecord] });
```

Only `server` and `database` bind from configuration; set everything else in code. `Cratis__MongoDB__Server` and `Cratis__MongoDB__Database` override the file in a deployment. Values in code win over configuration, and a `client`, `server`, or `serverResolver` in code replaces a configured `server`. With `server`, Arc creates the client and closes it when the application is disposed.

## Options

| Option | Meaning |
| --- | --- |
| `client` | A caller-owned `MongoClient`; Arc leaves it open |
| `server` | A MongoDB URI; Arc creates the client and closes it with the application |
| `serverResolver(tenantId, context)` | A URI per tenant, for tenants on different servers |
| `database` | The default database name; other tenants use `<database>+<tenant>` |
| `databaseNameResolver(tenantId, context)` | A database name per tenant |
| `readModels` | Model classes registered for injection and command read-model resolution |
| `namingPolicy`, `collectionName`, `ignoreConventions` | See [Naming policies](naming-policies.md) and [Serializers](serializers.md) |
| `maxPageSize` | Page size cap, 100 by default, at most 10,000 |
| `maxObservableItems` | Observed snapshot cap, 1,000 by default, at most 10,000 |

Specify exactly one of `client`, `server`, or `serverResolver`, and either `database` or `databaseNameResolver`. A missing tenant or empty database name fails the request rather than reading an implicit default database.

## Write documents

The collection's query methods read. To write from a command, inject the same token and write through the driver collection, encoding the model first:

```typescript
await items.native.insertOne(items.codec.serialize(task));
```

Encoding through `codec` keeps the stored document in the shape reads expect. See [Serializers](serializers.md#write-through-the-driver).

## Related

- [Serializers](serializers.md)
- [Paging](paging.md)
- [Observing collections](observing-collections.md)
