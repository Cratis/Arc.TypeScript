---
title: Model-bound commands
description: Declare a command class with typed fields and a handle() method, prepare data in provide(), bind services and built-in values, and control its route.
---

A command expresses a change. You declare it as a class: decorated fields are the input, and `handle()` is the work. Arc binds the fields before calling `handle()`, so your code works with typed values rather than raw JSON.

## Declare fields and a handler

The [Tasks sample command](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/Registration.ts) is a complete, compiled example:

```typescript
import { field } from '@cratis/fundamentals';
import { command } from '@cratis/arc.core';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}
```

- `@command()` from `@cratis/arc.core` marks the class. It must have a public instance `handle()`, which may be inherited.
- `@field(Type)` from `@cratis/fundamentals` declares each input field and its wire type. Every field is required unless you add `@optional()`, `@nullable()`, or `@defaultValue(value)`. [Concepts](../../concepts.md) lists the supported types.
- [Generated artifact metadata](../../proxy-generation/generated-artifact-metadata.md) binds the `Tasks` parameter by type. Without it, use `@inject(Tasks)`. See [Dependency injection](../../dependency-injection.md).

`handle()` can return a plain value or a promise. The value becomes the result's `response`; concepts are encoded as their primitive value. To reject, deny, or return several values, see [Command outcomes](../command-outcomes.md).

## Prepare data in provide()

`provide()` is optional. It runs after validation and before `handle()`, on the same command instance, and its value becomes the **first** `handle()` argument, before injected services:

```typescript
@command()
export class RenameTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @inject(Tasks)
    provide(tasks: Tasks) {
        const task = tasks.byId(this.id);
        return task ?? rejected(validation('The task does not exist', ['id'], 'notFound'));
    }

    handle(task: TaskItem): void {
        task.title = this.title;
    }
}
```

This excerpt assumes the Tasks sample's `TaskId`, `TaskTitle`, `TaskItem`, and `Tasks`, and imports `rejected` and `validation` from `@cratis/arc.core`. Returning `rejected(...)` or `denied(...)` from `provide()` stops execution; `handle()` never runs.

For several prepared values, or values mixed with services, return `tuple(...)` from `provide()` and mark each `handle()` parameter with `@inject(provided(ValueType), commandContext(), provided(OtherType))`. Arc matches the marked values by runtime type, in declared parameter order. Unmarked preparation still uses the first parameter; Arc never silently matches a prepared value to a service.

## Bind built-in values

| Marker | Binds |
| --- | --- |
| `abortSignal()` | The request's `AbortSignal` |
| `commandContext()` | The current [`CommandContext`](../command-context.md) |
| `provided(Type)` | A value returned from `provide()`, matched by runtime type |
| `commandReadModel(Type)` | A read model loaded by the command's key; see [Command context](../command-context.md#load-a-read-model-by-key) |

Use them in `@inject(...)` on `handle()` or `provide()`, for example `@inject(abortSignal(), commandContext())`. Without generated metadata, standard decorators need these explicit markers because TypeScript erases parameter types.

## Route and namespace

The route combines the discovery namespace and the class name: `Tasks.Registration.RegisterTask` is served at `POST /api/tasks/registration/register-task`, and `POST <route>/validate` runs authorization and validation without calling `provide()` or `handle()`. Use `@command({ namespace: 'Tasks.Registration' })` to fix the namespace, and `@path('/api/custom-path')` when a folder move must not change the public URL. See [Endpoint mapping](../../core/endpoint-mapping.md).

## Build-time checks

Arc rejects declarations that would silently do nothing: `@inject` or authorization decorators on `provide()`, authorization on `handle()`, and a class added with `add()` that has no Arc decorator. The [ESLint rules](../../code-analysis/index.md) catch many of the same mistakes in the editor.

## Related

- [Command authorization](authorization.md)
- [Command validation](../command-validation.md)
- [Command context](../command-context.md)
- [Testing commands](../../testing/commands.md)
