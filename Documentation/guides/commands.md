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

This excerpt assumes `TaskId`, `TaskTitle`, and `Tasks` from the linked sample. Import `field` from `@cratis/fundamentals` and `command`, `inject` from `@cratis/arc.core`. Each concept declares `static valueType` for runtime decoding. `handle()` can return a plain value or a promise; concepts become primitive response values. `response(value)`, `rejected(...results)`, and `denied(reason)` remain explicit control outcomes. `tuple(first, second)` returns several response values as an array; it does **not** dispatch Chronicle events.

`provide()` is optional. It runs after validation and before `handle()` on the same command instance; its one preparation value becomes the **first** `handle` argument, before injected services. Returning `rejected(...)` or `denied(...)` stops execution. This is intentionally narrower than .NET's assignable-type matching and flattening of multiple provided values. Put other inputs on command fields, not in `handle()` parameters.

The command route combines the discovery namespace and class name: `Tasks.Registration.RegisterTask` uses `/api/tasks/registration/register-task`. `POST <route>/validate` runs authorization and input validation without calling `provide()` or `handle()`. Use `@route('/api/custom-path')` when a folder move must not change the public URL. `@roles('Admin')`, `@authorize()`, and `@allowAnonymous()` declare access on the class; contradictory access declarations on that class fail at startup.

Model-bound commands currently have **wire-shape validation only**. The .NET-style `CommandValidator<T>` and `ConceptValidator<T>` rule vocabulary is a later increment. For an immediate business rule, use a low-level [`defineCommand`](low-level-definitions.md) with `validate`, or explicitly return `rejected(...)` from `provide()` or `handle()` (after binding). See [Concepts](concepts.md) for wire types and [Dependency injection](dependency-injection.md) for service registration.
