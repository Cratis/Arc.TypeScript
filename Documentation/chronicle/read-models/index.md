---
title: Chronicle read models
description: Serve a Chronicle projection from an Arc query, load it into a command by key with commandReadModel, and look up instances with ChronicleReadModels.
---

Chronicle projects events into read models. The integration lets the same class be both a Chronicle read model and an Arc read model with queries, and lets a command load the current state of its own event source.

## One class, two roles

```typescript
import { field } from '@cratis/fundamentals';
import { fromEvent } from '@cratis/chronicle/projections';
import { argument, query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';

@readModel()
@fromEvent(LiveCreated)
export class LiveView {
    static readonly readModelId = 'ArcTypeScriptLiveView';
    @field(String) id = '';
    @field(String) name = '';

    @query(argument('id', String), service(ChronicleReadModels))
    static async byId(id: string, models: ChronicleReadModels): Promise<LiveView | null> {
        return models.getById(LiveView, id);
    }
}
```

This excerpt is from the [kernel suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/Integration/LiveArtifacts.ts), where `LiveCreated` is the event type. Arc's `@readModel()` exposes queries. Chronicle 6.7 infers the same model from `@fromEvent` (or a projection/reducer); do not add Chronicle's deprecated `@readModel()` decorator. Set `static readonly readModelId` only when you need to preserve a custom stored identifier.

`ChronicleReadModels` is a tenant-scoped service. Inject it with `service(ChronicleReadModels)` in a query or `@inject(ChronicleReadModels)` in a command. `getAll(type)` returns all projected instances and `getById(type, id)` returns one or `null`. For live results, `observeAll(type)` returns an RxJS `Observable<T[]>` (models must expose an `id` convertible to a string); provide a key selector when they do not. `observeById(type, id)` returns an `Observable<T | null>` that emits `null` when the model is removed. Both emit a snapshot before subscribing to changes; a change between the snapshot and subscription may be missed, so use `watch(type)` and reconcile from the store if gap-free observation matters. `watch(type)` returns an `Observable<ReadModelChangeset<T>>`, and `watchIterable(type)` retains the async-iterable path. Unsubscribe to stop watching. Chronicle remains an experimental integration.

## Load a read model into a command

```typescript
@command()
export class ReadLiveInCommand {
    @field(String) @key() id = '';
    @inject(commandReadModel(LiveView))
    handle(view: LiveView): string { return view.name; }
}
```

`commandReadModel(LiveView)` loads the model whose ID is the command's `@key()` value, from the tenant's event store. A missing required model becomes a validation failure; `commandReadModel(LiveView, { optional: true })` passes `null` when the SDK reports absence. Without a usable command key, both forms reject the command. The kernel suite verifies both the existing and the missing case.

- Only models identified by Chronicle in the application's artifact catalog qualify.
- If MongoDB owns a model instead, `withMongoDB` provides the same hook for its configured `readModels`. Do not register both integrations as owners of one type.
- Read models are not injected into validators. Make an explicit tenant-scoped lookup in a rule when validation needs state.

## Related

- [Command context](../../commands/command-context.md#load-a-read-model-by-key)
- [Returning events](../commands/index.md)
