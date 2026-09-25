---
title: Observe joined MongoDB collections
description: Combine current tenant-scoped collections and re-emit the result when either changes.
---

A catalog can depend on books **and** their authors. Observing only books leaves the catalog stale when an author changes. Resolve the scoped watcher, join the two collections, and select the result you want to publish:

```typescript
import { mongoCollection, mongoDBWatcher } from '@cratis/arc.mongodb';

const books = await scope.resolve(mongoCollection(Book));
const authors = await scope.resolve(mongoCollection(Author));
const watcher = await scope.resolve(mongoDBWatcher);
const catalog = watcher.observe(books, { published: true })
    .join(authors, { active: true })
    .select((publishedBooks, activeAuthors) => ({ publishedBooks, activeAuthors }));

const subscription = catalog.subscribe(value => console.log(value));
// When the consumer is done:
subscription.unsubscribe();
```

The example is a service fragment: register both models with `withMongoDB({ readModels: [Book, Author], ... })`, and resolve the scope under a trusted tenant identity. The filters are **MongoDB filters in stored field names**, not predicates; use trusted values. See [naming policies](naming-policies.md#names-in-your-own-filters).

`select` returns an RxJS `Observable<TResult>`, rather than .NET's `ISubject<TResult>`. It first emits a combined snapshot, then recomputes it after a change to either collection. Call `.join(thirdCollection, filter?)` before `select` to combine three collections. Every change in a watched collection triggers a refetch, even when the changed document does not match a filter. Consecutive changes while a read is in progress are coalesced into another complete snapshot, not buffered without a bound. Do not treat emissions as an audit trail or a transactionally consistent view across collections.

The per-collection `maxObservableItems` cap applies to **each** joined snapshot. If a read, selector, or change stream fails, the observable errors instead of sending a partial list. The watcher shares one database-level stream per scope; subscriptions close on unsubscribe or scope disposal. Never keep a tenant-scoped collection in a singleton. See [change-stream watcher](change-stream-watcher.md) for recovery limits and [single-collection observation](observing-collections.md) when joins are unnecessary.
