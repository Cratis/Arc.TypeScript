---
title: Read models from MongoDB
description: Serve Arc queries from MongoDB with an explicit tenant database, a filter your code controls, and count-then-page results.
---

A query that reads from MongoDB has to get three things right on every request: which tenant's database it reads, which documents the caller may see, and how many rows it returns. The optional `@cratis/arc.server.mongodb` package gives you one small class, `MongoReadModels`, that makes each of those an explicit decision in your code and hands paged results to Arc without slicing them twice.

:::note[What this package does and does not do]
`MongoReadModels` only reads. It has no writes, transactions, change streams, observable queries, projections, or concept serialization, and it is not parity with Arc's .NET MongoDB support. The package is not published to npm.
:::

## Before you start

- A workspace inside a clone of this repository, as described in [Get started](../getting-started.md). Reference `@cratis/arc.server.mongodb` with the `workspace:^` protocol.
- The `mongodb` driver, version 6.21 or later within major version 6. It is a peer dependency, so your application installs it.
- A `MongoClient` your application creates and closes.

## Define queries over a collection

```typescript title="tasks.ts"
import { ArcServer, AuthenticationStatus, defineQuery } from '@cratis/arc.server';
import type { AuthenticationHandler } from '@cratis/arc.server';
import { MongoReadModels } from '@cratis/arc.server.mongodb';
import { MongoClient, ObjectId } from 'mongodb';
import { z } from 'zod';

interface Task { _id: ObjectId; title: string; status: string; owner: string }

// Development only: a fixed token instead of real token verification.
const developmentUser: AuthenticationHandler = request =>
    request.headers.get('authorization') === 'Bearer ada-dev-token'
        ? { status: AuthenticationStatus.Authenticated, principal: { id: 'ada', roles: [], isAuthenticated: true } }
        : { status: AuthenticationStatus.Anonymous };
const tenantDatabases = new Map([['acme', 'tasks_acme']]);

export const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017');

const tasks = new MongoReadModels<Task, { status: string }>({
    client,
    maxPageSize: 50,
    databaseForTenant: tenantId => tenantDatabases.get(tenantId) ?? '',
    filterFor: ({ status }, context) => ({ status, owner: context.principal?.id ?? '' })
}, 'tasks');

const byStatus = defineQuery({
    name: 'ByStatus',
    namespace: 'Tasks',
    schema: z.object({ status: z.string() }),
    authorization: { authenticated: true },
    perform: (input, context, options) => tasks.queryPage(context, input, options, { sort: { title: 1 } })
});

const byId = defineQuery({
    name: 'ById',
    namespace: 'Tasks',
    schema: z.object({ id: z.string().regex(/^[0-9a-f]{24}$/), status: z.string() }),
    authorization: { authenticated: true },
    perform: ({ id, status }, context) => tasks.findById(context, { status }, new ObjectId(id))
});

export const arc = new ArcServer({
    queries: [byStatus, byId],
    authentication: [developmentUser],
    resolveTenant: (_request, principal) => principal ? 'acme' : undefined
});
```

Mount `arc` in a host as in [Host Arc in Express, Fastify, or Hono](host-integration.md), and close `client` when your process shuts down. `GET /api/tasks/by-status?status=open&page=0&pageSize=20` with Ada's token returns the first 20 of her open tasks, sorted by title, with `paging.totalItems` counting all of them.

## The decisions you own

`MongoReadModels<T, I>` takes an options object and a collection name. `T` is the document type and `I` is the input your filter reads.

| Option | Purpose |
| --- | --- |
| `client` | Your `MongoClient`. The package never connects or closes it. |
| `databaseForTenant(tenantId, context)` | Returns the database name for a tenant. Map known tenants explicitly: when the context has no tenant, or this returns an empty string, the read fails instead of falling back to the driver's default database. |
| `filterFor(input, context)` | Builds the MongoDB filter from the parsed query input and the context. It is applied to every read. |
| `maxPageSize` | The largest page `page` and `queryPage` accept. The default is 100; it must be a positive safe integer. |

`filterFor` is where access control on documents lives. Build the filter from specific fields, as the example does, and never pass request JSON through as a filter. Scope it to the caller, as the `owner` condition does. The tenant comes from Arc's context; with the default header resolver the caller chooses it, so derive it from the principal or check it in `authorize`, as described in [Configure the server](configuration.md#resolve-the-tenant).

## The read methods

| Method | Returns |
| --- | --- |
| `find(context, input, options?)` | Every document matching the filter, as an array. No page size cap applies. |
| `findById(context, input, id)` | One document matching both the filter and `_id`, or `null`. `id` must be a string, finite number, boolean, bigint, or `ObjectId`; anything else, such as an object, is rejected. |
| `page(context, input, { page, pageSize }, options?)` | `{ items, paging }` with `page` and `pageSize` checked and capped by `maxPageSize` |
| `queryPage(context, input, queryOptions, options?)` | A page for Arc to return from `perform`, built with Arc's `queryPage` |

Every method passes `context.signal` to the driver, so a cancelled request stops its database work. It replaces any `signal` in the options you pass.

`page` counts first and then reads the page:

- The count uses the same filter and your `collation`, `hint`, `session`, `readPreference`, `readConcern`, `maxTimeMS`, and `comment`, without skip or limit. Count and find are separate reads: concurrent writes can make them disagree and cause Arc to reject the page. For a consistent snapshot on a deployment that supports snapshot sessions, supply a session created with `client.startSession({ snapshot: true })` and end it after the operation. Arc does not create a snapshot session or transaction automatically.
- `sort` accepts only an object of field names and `1` or `-1`. Arc adds `_id: 1` as the last sort key unless you sort by `_id`, so documents with equal sort values never move between pages.

## Paging through Arc

`queryPage` takes the `options` Arc passes to `perform` and needs paging in them:

- Without paging, for example a GET request without `pageSize`, it throws and the query fails with a 500. Call the query with `page` and `pageSize`, or use `find` for queries that are meant to return everything.
- Arc's own `sortBy` or `sorting` makes it throw, because it does not translate Arc sorting into MongoDB. Pass the sort in its last argument instead.
- A page size above `maxPageSize` makes it throw.

## How it is checked

The package specs run against a substitute collection in `yarn specs`. A live spec starts a MongoDB 7 single-node replica set in Docker and checks tenant and owner isolation, rejected identifiers, collation-aware counts, stable paging with duplicate sort values, the Arc query pipeline, and cancellation:

```bash
bash Integrations/MongoDB/run-integration.sh
```

It exits with 2 without running anything when Docker is not available.

## Related

- [Bind query arguments, page, and sort](queries.md)
- [Capability reference](../reference/capabilities.md)
