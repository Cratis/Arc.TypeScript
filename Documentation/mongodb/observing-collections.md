---
title: Observing collections
description: Turn a tenant's MongoDB collection into an observable query with change streams, and know the snapshot, burst, cap, and replica-set rules.
---

A live list backed by MongoDB should update when a document changes, whichever process wrote it. `observe` opens a change stream on the tenant's collection and turns it into an Arc observable source.

```typescript
@query({ observable: true }, service(tasks))
static async changes(items: MongoCollection<TaskRecord>) {
    return items.observe();
}
```

`items.observe(filter?)` returns full snapshots of the matching documents; `items.observeById(id)` returns one document, or `null` after it is deleted. Deleting the last matching document from a list appears as an empty list.

## How observation works

1. The stream opens **before** the first snapshot, from a server operation time captured beforehand, so no change between the two is lost.
2. The source has a current value, so a plain GET answers 200, and server-sent events and WebSockets deliver full snapshots on each change.
3. After queued changes, the query is recomputed, even for changes that do not affect the filter. Bursts may be coalesced.
4. `observeById` filters the stream by document key, like Arc on .NET's `ObserveById` and `ObserveSingle`.

Each subscriber owns its stream. Scope disposal, cancellation, or closing the iterator closes the cursor.

## Limits

- A full snapshot is capped at 1,000 documents by default; `maxObservableItems` raises it to at most 10,000. Exceeding the cap fails the subscription rather than returning a partial list.
- A standalone MongoDB server is rejected with a replica-set requirement. Replica sets and sharded clusters support change streams.
- The driver resumes resumable stream errors; a non-resumable failure ends the subscription.
- Joined observation across collections is not available.

## Related

- [Observable queries](../queries/observable-queries.md)
- [MongoDB](index.md)
