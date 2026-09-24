---
title: Chronicle read models
description: Serve a Chronicle projection from an Arc query, load it into a command by key with commandReadModel, and look up instances with ChronicleReadModels.
---

Chronicle projects events into read models. The integration lets the same class be both a Chronicle read model and an Arc read model with queries, and lets a command load the current state of its own event source.

## One class, two roles

```typescript
import { field } from '@cratis/fundamentals';
import { readModel as chronicleReadModel } from '@cratis/chronicle/readModels';
import { fromEvent } from '@cratis/chronicle/projections';
import { argument, query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';

@readModel()
@chronicleReadModel('ArcTypeScriptLiveView')
@fromEvent(LiveCreated)
export class LiveView {
    @field(String) id = '';
    @field(String) name = '';

    @query(argument('id', String), service(ChronicleReadModels))
    static async byId(id: string, models: ChronicleReadModels): Promise<LiveView | null> {
        return models.findInstanceById(LiveView, id);
    }
}
```

This excerpt is from the [kernel suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/Integration/LiveArtifacts.ts), where `LiveCreated` is the event type. A class used by both Arc queries and Chronicle projections needs **both** `@readModel()` decorators; alias one import, as here.

`ChronicleReadModels` is a tenant-scoped service. Inject it with `service(ChronicleReadModels)` in a query or `@inject(ChronicleReadModels)` in a command, and call `findInstanceById` or `watch`.

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

- Only Chronicle-decorated models in the application's artifact catalog qualify.
- If MongoDB owns a model instead, `addMongoDB` provides the same hook for its configured `readModels`. Do not register both integrations as owners of one type.
- Read models are not injected into validators. Make an explicit tenant-scoped lookup in a rule when validation needs state.

## Related

- [Command context](../../commands/command-context.md#load-a-read-model-by-key)
- [Returning events](../commands/index.md)
