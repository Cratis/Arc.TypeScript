---
title: Command context
description: Read a command's key, values, and request identity from CommandContext, bind the context and the abort signal, and load a read model by the command key.
---

`handle()` knows its own fields. Sometimes it also needs to know who is calling, which tenant it runs in, or which entity the command is about. Arc gathers that into one `CommandContext` per execution, shared by handlers, execution scopes, and response value handlers.

## What the context holds

| Property | Meaning |
| --- | --- |
| `operationName` | The declaration's namespace-qualified name (`fullyQualifiedName` in introspection); optional on manually built contexts |
| `command` | The bound command instance |
| `key` | The command's key, resolved once per execution; `undefined` when none |
| `values` | Named values from context value providers; lookup is case-insensitive |
| `correlationId` | The request's correlation ID |
| `principal` | The authenticated caller, or `undefined` |
| `tenantId` | The resolved tenant, or `undefined` |
| `allowedSeverity` | The [severity](validation-severity-filtering.md) that blocks |
| `signal` | An `AbortSignal` that aborts when the caller disconnects |

Arc-created command contexts have a non-writable, non-configurable `operationName`; the rest of the context remains mutable for values and response handling. Manually built contexts can omit the name. Authorization filters that depend on it must deny an absent name or explicitly handle manual contexts, never infer the operation from the command payload. `currentContext()` returns the execution context from anywhere inside the request, even deep in a service.

## Bind it into a handler

```typescript
import { field } from '@cratis/fundamentals';
import { abortSignal, command, commandContext, inject, key, type CommandContext } from '@cratis/arc.core';

@command()
export class AssignTask {
    @field(String) @key() taskId!: string;
    @field(String) assignee!: string;

    @inject(commandContext(), abortSignal())
    handle(context: CommandContext, signal: AbortSignal): string {
        signal.throwIfAborted();
        return `${context.key} -> ${this.assignee} (${context.values.get('source') as string})`;
    }
}

export class RequestSource {
    provide(): Record<string, unknown> { return { source: 'web' }; }
}
```

With `builder.services.addScoped(RequestSource)` and `builder.addCommandContextValuesProvider(RequestSource)`, `POST /api/assign-task` with `{ "taskId": "t1", "assignee": "ada" }` answers `"response":"t1 -> ada (web)"`. `commandContext()` and `abortSignal()` are explicit markers: standard decorators cannot see parameter types, so Arc needs them to know what to pass.

## Give a command a key

The key identifies what the command is about, such as the task being assigned. No key is inferred from an unmarked `id` field.

1. Scoped `CommandKeyResolver` rules registered with `builder.addCommandKeyResolver(token)` run first. Each has `resolve(command)` returning a string or `undefined`.
2. If none answers, a command that implements `getKey()` uses its result.
3. Otherwise the field marked `@key()` is used; a concept is unwrapped to its primitive value.

Arc resolves the key once per execution, after declared authorization and binding but before global authorization filters. Context-value providers and key resolvers are trusted preparation and must not make protected business mutations; they are different from command `provide()`, which runs after authorization and validation. The .NET equivalent of a key rule is `ICanResolveKeyForCommand`. The experimental Chronicle integration also uses the key as the default event source ID; see [Resolving the event source ID](../chronicle/resolving-event-source-id.md).

## Add values to every command

A `CommandContextValuesProvider` has `provide(command)` returning a map or record, or a promise of one. Providers run once per command in registration order; a later provider overwrites a name case-insensitively. Register them with `builder.addCommandContextValuesProvider(token)` after registering the token as a service, or with the `commandContextValuesProviders` option.

## Load a read model by key

`commandReadModel(Type)` binds a `handle()` or `provide()` parameter to the read model whose identity equals the command key:

```typescript
@inject(commandReadModel(TaskView))
handle(task: TaskView): void { /* ... */ }
```

A registered `ReadModelForCommandResolver` must own the type. The [MongoDB](../mongodb/index.md) and experimental [Chronicle](../chronicle/read-models/index.md) integrations provide resolvers for the models you configure; you can register your own with `builder.addReadModelForCommandResolver(token)`, implementing `supports(type)` and `find(type, key, context)`.

- A missing model becomes a validation failure. `commandReadModel(Type, { optional: true })` passes `null` instead.
- Without a usable command key, the command is rejected.
- Two resolvers claiming the same type fail rather than one winning by registration order.
- Validators do not receive read models this way.

## Related

- [Model-bound commands](model-bound/index.md)
- [Command execution scopes](command-execution-scopes.md)
- [Response value handlers](response-value-handlers.md)
