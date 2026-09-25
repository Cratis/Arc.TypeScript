---
title: Watch MongoDB changes across collections
description: React to tenant-scoped database changes with a shared stream and bounded observation lifetimes.
---

When several parts of your application need to respond to MongoDB changes, opening a separate change stream for each one is wasteful. Resolve `mongoDBWatcher` in the same Arc scope as your collections. The watcher shares one **database-level** change stream among subscriptions in that scope, and routes collection changes to each subscriber.

This is a source-preview API. It is not a durable event consumer or a replacement for Chronicle.

## React to changes

The example assumes a configured Arc application, an active tenant scope, and registered `Book` and `Author` models:

```typescript
import { mongoCollection, mongoDBWatcher } from '@cratis/arc.mongodb';

const books = await scope.resolve(mongoCollection(Book));
const watcher = await scope.resolve(mongoDBWatcher);
const subscription = watcher.changes(books).subscribe(change => {
    console.log(change.operationType, change.documentKey);
});

// On shutdown or when this work ends:
subscription.unsubscribe();
await scope.dispose();
```

`changes` returns an RxJS `Observable<ChangeStreamDocument<Document>>`. Updates use MongoDB's `updateLookup` full-document option; deletes have a document key but no full document. Do not persist a resume token from this API or use it as an exactly-once feed.

## Scope and failure

MongoDB change streams require a replica set or sharded cluster and database-level watch permissions. A standalone server fails before the initial read. Join only collections resolved from the **same tenant and Arc scope** as the watcher; a cross-scope or cross-tenant collection is rejected. Disposing the scope, aborting its signal, or unsubscribing the last listener closes the cursor. A later subscription opens a new stream and starts at a new operation time.

The driver resumes errors it recognizes as resumable. Other errors terminate all subscribers with `error`; the watcher does **not** silently reconnect and skip an unknown interval. Resubscribe with a fresh scope and re-read authoritative state if you need recovery. The watcher holds no durable checkpoint.

For a live combined result, use [joined observation](joined-observe.md). For a single collection's complete snapshots, [observe on the collection](observing-collections.md) instead.
