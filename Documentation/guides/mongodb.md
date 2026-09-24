---
title: Read models from MongoDB
description: Bind tenant-scoped MongoDB collections to model-bound Arc queries and observe changes on a replica set.
---

If your read models live in MongoDB, `@cratis/arc.mongodb` supplies a collection for each Arc execution's tenant. Your model declares its fields once; the collection maps them to BSON, and its queries return instances of your model. This optional package is a source preview, not yet published to npm.

:::caution[Storage does not authorize a caller]
Arc selects a tenant from the execution context; the collection selects that tenant's database. Your authentication and authorization still have to verify that the caller may use that tenant and read those documents. Never pass untrusted request JSON directly to a MongoDB filter.
:::

## Bind a model and a query

Install the MongoDB 6 driver and reference `@cratis/arc.mongodb` from this workspace. The following excerpt uses the [replica-set integration fixture](../../Source/MongoDB/for_MongoCollection/given/TaskQueries.ts); it assumes the `TaskRecord` class shown next and a trusted tenant resolver on your Arc host:

```typescript
import { ArcApplication } from '@cratis/arc.core';
import { MongoClient } from 'mongodb';
import { mongoCollection } from '@cratis/arc.mongodb';
import { TaskRecord } from './TaskRecord.js';
import { TaskQueries } from './TaskQueries.js';

const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017');
const builder = ArcApplication.createBuilder();
builder.add(TaskQueries).addMongoDB({
    client, databaseNameResolver: tenant => `tasks_${tenant}`, readModels: [TaskRecord]
});
const app = await builder.build();
// Mount app in your host; call await app.dispose() and await client.close() on shutdown.
```

`addMongoDB` becomes available when the MongoDB package is imported. It leaves a supplied client open. If you supply `server` instead, Arc owns the URI-created client and closes it with the application. Specify exactly one of `client`, `server`, or `serverResolver`; specify `database` or `databaseNameResolver`. A missing tenant or empty database name fails rather than reading an implicit default database. With `database: 'tasks'`, tenant `default` gets `tasks`, and `acme` gets `tasks+acme`. A `serverResolver(tenantId, context)` can route tenants to different MongoDB servers; it must return a URI.

The [test model](../../Source/MongoDB/for_MongoCollection/given/TaskRecord.ts) uses `@field` metadata and `@key()` for `_id`:

```typescript
import { field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';

export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
}
```

A query injects the scoped collection through `service(mongoCollection(TaskRecord))`. This excerpt is from the [test query](../../Source/MongoDB/for_MongoCollection/given/TaskQueries.ts):

```typescript
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

Import `readModel`, `query`, `queryOptions`, `service`, and the `QueryOptions` type from `@cratis/arc.core`; import `MongoCollection` from `@cratis/arc.mongodb`. The complete fixture contains those imports. For an owner-restricted query, build a specific filter from the verified principal, for example `items.find({ owner: principal.id })`, rather than forwarding a caller-provided object. The query method owns that policy.

## Storage format and driver access

`MongoCollection<T>.codec` maps decorated fields to BSON; `native` is the underlying `mongodb` driver collection. For a write performed elsewhere in your application, encode the model first: `await items.native.insertOne(items.codec.serialize(task))`. Reads through `items.find(filter)` and `items.findById(id)` materialize model instances. `findById` rejects operator objects as identities. Using `native` for reads instead returns driver documents, not model instances.

The default codec maps `@key()` (or an `id` field) to `_id`, uses camelCase field names, stores Guid values as standard UUID binary (subtype 4), concepts as their underlying primitives, DateOnly as UTC noon BSON dates, TimeOnly as milliseconds after the Unix epoch, TimeSpan as a string, and Date as a BSON date. Nested decorated models and arrays use the same mapping. A class annotated with Fundamentals `@derivedType('identifier')` writes `_derivedTypeId`; an unknown discriminator fails rather than creating a base model. `ignoreConventions: true` bypasses the codec for existing driver-native documents; in that mode you own field names and conversion yourself. No global BSON conventions are installed.

## Page and observe

Use `@query(service(tasks), queryOptions())` to receive Arc's paging and sorting options, then call `items.queryPage(filter, options)`. The helper requires paging, caps each page at 100 by default (`maxPageSize` can raise it to at most 10,000), counts the filter in MongoDB, and applies the requested sort before `skip` and `limit`. Only fields declared on the model may be sorted; an `_id` tie-breaker makes page ordering stable. `queryPage` returns Arc's provider-owned `queryPage`, including the total. Count and find are separate reads, so concurrent writes can change the count between them; this is not a snapshot transaction. You can also use `items.find()` for an unpaged query.

`items.observe(filter?)` and `items.observeById(id)` open a MongoDB change stream before taking the first snapshot. They return Arc observable sources with a current value for plain GET and full snapshots on changes for SSE/WebSocket; deletion appears as an empty list or `null`. The stream watches the tenant's collection and recomputes the query after every change, including changes that do not affect the filter. Each subscriber owns its stream. A full snapshot is capped at 1,000 documents by default (`maxObservableItems` can raise it to at most 10,000); exceeding the cap fails the subscription rather than returning a partial list. Arc scope disposal, cancellation, or closing the iterator closes the cursor. A standalone MongoDB server is rejected with a replica-set requirement, and a failed change stream terminates the observable query; there is no automatic resume or join observation.

The original `MongoReadModels<T, I>` remains available for low-level `defineQuery` users. It takes a caller-owned client, `databaseForTenant`, and a trusted `filterFor(input, context)`. Its `queryPage` accepts Arc sorting only for fields listed in `sortableFields`; other fields fail closed. Its page size cap defaults to 100. This helper has no change-stream or metadata codec behavior; use the model-bound collection for those.

To check the live behavior, run `bash Source/MongoDB/run-integration.sh` from this repository. The script starts a task-owned MongoDB 7 replica set and removes it afterward. The [integration spec](../../Source/MongoDB/for_MongoCollection/when_observing_changes/with_a_replica_set.integration.ts) exercises initial snapshots, insertion, deletion, tenant isolation, DI and provider paging. A second [HTTP integration spec](../../Source/MongoDB/for_MongoCollection/when_serving_a_paged_query/with_each_http_adapter.integration.ts) exercises sorted pages through Express, Fastify and Hono. Docker is required.

## Current boundaries

There is no command-side read-model resolver hook in Arc Core yet, so `addMongoDB` cannot inject a read model directly into a command by its key. Inject `mongoCollection(Model)` and call `findById` explicitly instead. This integration does not supply transactions, shared watcher/reconnect policy, joined observations, geometric serializers, resilience middleware, or Mongo driver metrics. None of those guarantees should be inferred from Arc on .NET. See the [capability reference](../reference/capabilities.md) for the broader parity picture.
