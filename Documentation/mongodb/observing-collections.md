---
title: Observing collections
description: Turn a tenant's MongoDB collection into an observable query with change streams, page and sort it, handle deleted documents, and know what happens when the stream fails.
---

A task list backed by MongoDB should update when a document changes, whichever process wrote it: this service, another service, or a script. Polling is either slow or wasteful. `observe` opens a MongoDB change stream on the tenant's collection and turns it into an Arc observable source, so the client receives a new list whenever the collection changes.

```typescript
import type { Observable } from 'rxjs';
import { query, readModel, service } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import { TaskRecord } from './TaskRecord.js';

const tasks = mongoCollection(TaskRecord);

@readModel()
export class TaskChanges {
    @query({ observable: true }, service(tasks))
    static all(items: MongoCollection<TaskRecord>): Observable<TaskRecord[]> {
        return items.observe();
    }
}
```

A GET on this query answers 200 with the current tasks. Server-sent events and WebSocket subscribers receive the full list now, and again after every change. Change streams need a replica set or a sharded cluster.

## Choose what to observe

| Method | Emits |
| --- | --- |
| `observe(filter?)` | Every document matching the filter, as a full list |
| `observeById(id)` | One document, or `null` while it does not exist |
| `observeIterable(filter?)` | The same lists as `observe`, as an async iterable, without RxJS |
| `observeByIdIterable(id)` | The same values as `observeById`, as an async iterable |

The filter is a raw MongoDB filter in stored names; see [Names in your own filters](naming-policies.md#names-in-your-own-filters). Build it from trusted values, never from request JSON.

## How observation works

1. The change stream opens **before** the first snapshot is read, from a server operation time captured just before, so a change between the two is not lost.
2. The first snapshot is the source's current value, so a plain GET answers 200 without waiting.
3. After each change, and after any changes already queued behind it, the whole query is read again. A burst of changes becomes one new list.
4. For `observe`, every change on the collection triggers a new read, even one that does not affect the filter, so the list you receive is always complete. `observeById` reacts only to changes of its own document.

Each subscription opens one change stream on its first read. Unsubscribing, closing the connection, or disposing the Arc scope closes the cursor. The async iterables also close when the loop exits.

## When a document is gone

- `observe` drops a deleted document from the next list. Deleting the last matching document emits an empty list.
- `observeById` emits `null` when the document is deleted, and emits the document again if it is recreated with the same ID.
- A document that is updated so it no longer matches the filter drops out of the next list, like a deletion.

A client should treat `null` and an empty list as ordinary states, not as errors.

## Page and sort an observed query

A client can page and sort an observable query with the same parameters as a snapshot query. Arc applies them to **each** emitted list in memory, with the same options for the whole subscription:

```text
GET /api/.../all?pageSize=10&page=0&sortBy=title
```

Each emission then holds the first ten tasks by title, and `paging.totalItems` counts every document in that emission's list. The database still returns the full matching list on every change; paging only trims what is sent. Keep observed filters narrow, and use [`queryPage`](paging.md) for large collections that do not need to be live.

## Limits

- A full list is capped at 1,000 documents by default; `maxObservableItems` raises the cap to at most 10,000. A list that exceeds the cap, on the first read or on any later one, fails the subscription instead of sending a partial list.
- A standalone MongoDB server is rejected with `MongoDB observe requires a replica set with change streams`. Replica sets and sharded clusters support change streams.
- For several collections, use [joined observation](joined-observe.md); each collection has its own snapshot cap.

## When the stream fails

The MongoDB driver resumes the change stream after errors it knows are transient, such as a replica-set election. Your subscription does not notice.

Anything else ends the subscription with a query failure: a change stream error the driver cannot resume, a read that fails, the item cap, or the change stream ending on its own (`MongoDB change stream ended`). Arc closes the cursor and reports the failure to the subscriber. It does not reopen the stream by itself.

To recover, subscribe again. A new subscription opens a new change stream and reads a fresh, complete list, so the client catches up on everything that changed in between.

## Related

- [Observable queries](../queries/observable-queries.md)
- [Paging](paging.md)
- [MongoDB](index.md)
- [Change-stream watcher](change-stream-watcher.md)
