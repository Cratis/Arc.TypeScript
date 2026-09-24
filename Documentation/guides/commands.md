---
title: Define model-bound commands
---

Use a command to express a change. Arc binds its decorated fields before calling `handle()`, so the handler works with typed values rather than raw JSON. The [Tasks sample command](../../Samples/Tasks/Features/Tasks/Registration/RegisterTask.ts) is a complete, compiled example:

```typescript
@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @inject(Tasks)
    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}
```

This excerpt assumes `TaskId`, `TaskTitle`, and `Tasks` from the linked sample. Import `field` from `@cratis/fundamentals` and `command`, `inject` from `@cratis/arc.core`. Each concept declares `static valueType` for runtime decoding. `handle()` can return a plain value or a promise; concepts become primitive response values. `response(value)`, `rejected(...results)`, and `denied(reason)` remain explicit control outcomes. `tuple(first, second)` returns a branded value (serialized as a response array) distinct from an ordinary array; it does **not** dispatch Chronicle events.

`provide()` is optional. It runs after validation and before `handle()` on the same command instance; its one preparation value becomes the **first** `handle` argument, before injected services. Returning `rejected(...)` or `denied(...)` stops execution. This is intentionally narrower than .NET's assignable-type matching and flattening of multiple provided values. Put other inputs on command fields, not in `handle()` parameters.

The command route combines the discovery namespace and class name: `Tasks.Registration.RegisterTask` uses `/api/tasks/registration/register-task`. `POST <route>/validate` runs authorization and input validation without calling `provide()` or `handle()`. Use `@path('/api/custom-path')` when a folder move must not change the public URL; `@route()` remains an alias. `@roles('Admin')`, `@authorize()`, and `@allowAnonymous()` declare access on the class. Each stacked requirement must pass, while roles within one `@roles()` declaration are alternatives. Putting authorization or `@inject` on `provide()` or authorization on `handle()` fails at build time: these declarations have no endpoint effect.

Model-bound commands support `CommandValidator<T>` and `ConceptValidator<T>` for server-side rules (see [Validation](validation.md)). For an immediate business rule without a validator, explicitly return `rejected(...)` from `provide()` or `handle()` (after binding). See [Concepts](concepts.md) for wire types and [Dependency injection](dependency-injection.md) for service registration.
