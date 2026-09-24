---
title: Define model-bound commands
description: Declare a command class with typed fields and a handle() method, prepare data in provide(), and control its route and access.
---

Use a command to express a change. Arc binds its decorated fields before calling `handle()`, so the handler works with typed values rather than raw JSON. The [Tasks sample command](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/RegisterTask.ts) is a complete, compiled example:

```typescript
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

This excerpt assumes `TaskId`, `TaskTitle`, and `Tasks` from the linked sample. Import `field` from `@cratis/fundamentals` and `command` from `@cratis/arc.core`. Generate and install [artifact metadata](generated-artifact-metadata.md) before building the application to bind `Tasks` without an explicit token. Without generation, put `@inject(Tasks)` on `handle()` instead. Each concept declares `static valueType` for runtime decoding. `handle()` can return a plain value or a promise; concepts become primitive response values. `response(value)`, `rejected(...results)`, and `denied(reason)` remain explicit control outcomes. `tuple(first, second)` groups server-handled values with **at most one** client response. Two values without response handlers fail the command; ordinary arrays stay ordinary response values. A tuple does **not** dispatch Chronicle events. See [Return command values](command-outcomes.md) and [Declare command operations](command-operations.md).

`provide()` is optional. It runs after validation and before `handle()` on the same command instance; its one preparation value becomes the **first** `handle` argument, before injected services. `@inject(abortSignal(), commandContext())` binds an `AbortSignal` and the current `CommandContext` to `handle()` or `provide()` when not using generated metadata. Returning `rejected(...)` or `denied(...)` stops execution. For multiple preparation values or interspersed parameters, return `tuple(...)` from `provide()` and mark each target with `@inject(provided(ValueType), commandContext(), provided(OtherType))`; Arc matches those marked values by runtime type in declared parameter order. Without generated metadata, standard decorators need these explicit descriptors because TypeScript erases parameter types. Unmarked preparation still uses the first parameter; it is not silently matched to services.

Use `@key()` on one `@field` property to give the command an explicit key, or implement `getKey()` on the command. Arc captures that key on the `CommandContext` once per execution. You can also register `CommandKeyResolver` rules ahead of the default resolver (the .NET equivalent is `ICanResolveKeyForCommand`). No key is inferred from an unmarked `id` field.

The command route combines the discovery namespace and class name: `Tasks.Registration.RegisterTask` uses `/api/tasks/registration/register-task`. `POST <route>/validate` runs authorization and input validation without calling `provide()` or `handle()`. Use `@path('/api/custom-path')` when a folder move must not change the public URL. `@roles('Admin')`, `@authorize()`, and `@allowAnonymous()` declare access on the class. Each stacked requirement must pass, while roles within one `@roles()` declaration are alternatives. Putting authorization or `@inject` on `provide()` or authorization on `handle()` fails at build time: these declarations have no endpoint effect.

Model-bound commands support `CommandValidator<T>` and `ConceptValidator<T>` for server-side rules (see [Validation](validation.md)). For an immediate business rule without a validator, explicitly return `rejected(...)` from `provide()` or `handle()` (after binding). See [Concepts](concepts.md) for wire types and [Dependency injection](dependency-injection.md) for service registration.
