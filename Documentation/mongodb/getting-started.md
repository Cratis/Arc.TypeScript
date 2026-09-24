---
title: Get started with MongoDB
description: Register a MongoDB client and read models with addMongoDB, inject a tenant-scoped collection into model-bound queries, and own the client's lifetime.
---

This page connects one read model to MongoDB and serves it from a query. The code comes from the package's [replica-set integration fixture](https://github.com/Cratis/Arc.TypeScript/tree/main/Source/MongoDB/for_MongoCollection/given).

## Declare the model

```typescript title="TaskRecord.ts"
import { field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';

export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
}
```

`@key()` marks the field stored as `_id`; without it, a field named `id` is used.

## Inject the collection into queries

```typescript title="TaskQueries.ts"
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
    static async changes(items: MongoCollection<TaskRecord>) {
        return items.observe();
    }
}
```

This excerpt omits the imports: `readModel`, `query`, `queryOptions`, `service`, and the `QueryOptions` type come from `@cratis/arc.core`; `mongoCollection` and `MongoCollection` from `@cratis/arc.mongodb`. `mongoCollection(TaskRecord)` is a service token for the current tenant's collection. For an owner-restricted query, build a specific filter from the verified principal, such as `items.find({ owner: principal.id })`, instead of forwarding a caller-provided object.

## Register MongoDB

```typescript title="main.ts"
import { ArcApplication } from '@cratis/arc.core';
import { MongoClient } from 'mongodb';
import '@cratis/arc.mongodb';
import { TaskRecord } from './TaskRecord.js';
import { TaskQueries } from './TaskQueries.js';

const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017');
const builder = ArcApplication.createBuilder({ tenancy: { sources: ['fixed'], fixed: 'default' } });
builder.add(TaskQueries).addMongoDB({
    client, databaseNameResolver: tenant => `tasks_${tenant}`, readModels: [TaskRecord]
});
const app = await builder.build();
await app.run();
await client.close();
```

Importing `@cratis/arc.mongodb` adds `addMongoDB` to the builder. You can instead call the exported `addMongoDB(builder, options)` function. The fixed `default` tenant makes this a single-tenant example; see [Tenancy](tenancy.md) for real tenant routing.

## Options

| Option | Meaning |
| --- | --- |
| `client` | A caller-owned `MongoClient`; Arc leaves it open |
| `server` | A MongoDB URI; Arc creates the client and closes it with the application |
| `serverResolver(tenantId, context)` | A URI per tenant, for tenants on different servers |
| `database` | The default database name |
| `databaseNameResolver(tenantId, context)` | A database name per tenant |
| `readModels` | Model classes registered for injection and command read-model resolution |
| `namingPolicy`, `collectionName`, `ignoreConventions` | See [Naming policies](naming-policies.md) and [Serializers](serializers.md) |
| `maxPageSize` | Page size cap, 100 by default, at most 10,000 |
| `maxObservableItems` | Observed snapshot cap, 1,000 by default, at most 10,000 |

Specify exactly one of `client`, `server`, or `serverResolver`, and either `database` or `databaseNameResolver`. A missing tenant or empty database name fails rather than reading an implicit default database.

## Related

- [Serializers](serializers.md)
- [Paging](paging.md)
- [Observing collections](observing-collections.md)
