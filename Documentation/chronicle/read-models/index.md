---
title: Chronicle read models
description: Serve a Chronicle projection from Arc queries with ChronicleReadModels, as a snapshot or a live observable, and know the consistency you get.
---

Chronicle projects events into read models and keeps them stored. You still need a query to hand them to the client, scoped to the caller's tenant, and ideally live so the screen updates when a new event lands. With the integration, one class is both the Chronicle read model and the Arc read model that serves it.

## One class, two roles

The [Library sample's author listing](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Listing/Listing.ts):

```typescript
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import type { Observable } from 'rxjs';
import { fromEvent } from '@cratis/chronicle/projections';
import { AuthorRegistered } from '../Registration/Registration.js';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';

@readModel()
@fromEvent(AuthorRegistered)
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query({ observable: true }, service(ChronicleReadModels))
    static allAuthors(models: ChronicleReadModels): Observable<Author[]> {
        return models.observeAll(Author, author => author.id.toString());
    }

    @query(service(ChronicleReadModels))
    static async authorsPage(models: ChronicleReadModels): Promise<Author[]> {
        return models.getAll(Author);
    }
}
```

Arc's `@readModel()` exposes the queries. Chronicle infers the same class as its read model from `@fromEvent`, or from a projection or reducer that targets it; do not add Chronicle's deprecated `@readModel()` decorator. `@fromEvent(AuthorRegistered)` copies the event's matching properties, and the event source ID becomes `id`. Set `static readonly readModelId` only when you need to keep a custom stored identifier.

`allAuthors` answers a GET with the current list and then pushes a new list on every change. `authorsPage` returns a snapshot, and Arc [pages and sorts](../../queries/model-bound/paging.md) the array in memory, which suits a small catalog but not an unbounded list.

## What ChronicleReadModels offers

`ChronicleReadModels` is a scoped service bound to the current tenant's event store. Inject it with `service(ChronicleReadModels)` in a query, or `@inject(ChronicleReadModels)` in a command.

| Member | Returns |
| --- | --- |
| `getAll(Type)` | Every projected instance in the tenant |
| `getById(Type, id)` or `findInstanceById(Type, id)` | One instance by event source ID, or `null` |
| `observeAll(Type, key?)` | An RxJS `Observable<T[]>`: a snapshot, then the updated list on every change |
| `observeById(Type, id)` | An `Observable<T \| null>` that emits `null` when the instance is removed |
| `watch(Type)` | An `Observable<ReadModelChangeset<T>>` of raw changes |
| `watchIterable(Type)` | The same changes as an async iterable, without RxJS |
| `getStore()` | The tenant's SDK `IEventStore`, for anything else |

`observeAll` keys the list by each model's `id`. Pass a key selector when your model names its identity differently, or when `id` is a concept, as `allAuthors` does with `author.id.toString()`. Unsubscribe, or let Arc end the subscription, to stop watching. SDK 6.9.1 and later omit the empty subscription marker from `watch()`; Arc also filters empty keys for older SDKs in its peer range.

## Consistency

- **Active projections are eventually consistent by default.** A command can succeed before its read model has updated. A client that reads right after a command can see the old state. An observable query catches up on its own. For a passive on-demand read or a bounded observer wait after a command, see [Read consistency](../../queries/read-consistency.md).
- **The first list can miss a change.** `observeAll` and `observeById` read a snapshot, then subscribe to changes. A change that lands between the two is missed until the next change. Use `watch(Type)` and reconcile from the store when you need gap-free observation.
- **Everything is tenant-scoped.** Reads use the current execution's tenant as the namespace, like appends.

## Use state in a command

A command can take the read model for its own key as a `handle()` or `provide()` parameter, and a validator can read it, with no query round-trip. See [Read models in commands](injecting-into-commands.md).

## Related

- [Observable queries](../../queries/observable-queries.md)
- [When read model resolution fails](failures.md)
- [Returning events](../commands/index.md)
