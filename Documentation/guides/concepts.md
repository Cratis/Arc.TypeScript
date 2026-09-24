---
title: Use concepts in model-bound fields
---

A domain identifier should not look like every other string to a handler. The [Tasks sample identifier](../../Samples/Tasks/Features/Tasks/TaskId.ts) wraps Fundamentals `Guid`:

```typescript
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class TaskId extends ConceptAs<Guid> {
    static readonly valueType = Guid;
    static create(): TaskId { return new TaskId(Guid.create()); }
}
```

Use `@field(TaskId) id!: TaskId` on a command or read model. The static `valueType` is necessary because TypeScript erases generic arguments at runtime. Incoming JSON strings become `TaskId` instances containing a `Guid`; responses convert them back to UUID strings. The sample's [`TaskTitle`](../../Samples/Tasks/Features/Tasks/TaskTitle.ts) similarly wraps a string. Empty strings and falsy numeric/boolean values are preserved, not treated as absent. An invalid UUID fails input binding with a 400 `malformedRequest` result.

`@field` also supports `String`, `Number`, `Boolean`, `Date`, `Guid`, `DateOnly`, `TimeOnly`, `TimeSpan`, nested decorated classes, and arrays. For an array of models use `@field(Array, { genericArguments: [TaskItem] })`; the older `@field(TaskItem, true)` enumerable form also works. Model-bound Arc does not rely on Fundamentals' `JsonSerializer` to decode these types. `Date` is an ISO timestamp on the wire; date-only and time-only types remain separate.

Every field is required unless you mark it `@optional()`, `@nullable()`, or supply `@defaultValue(value)`. Use `@enumeration(Priority)` alongside a scalar `@field(String)` or `@field(Number)` when its allowed values come from an enum object; a TypeScript enum is not a constructor that `@field` can accept. Arc uses the same metadata to decode requests and describe JSON Schema in introspection and OpenAPI. Server-side `ConceptValidator<T>` rules are not in this increment: use low-level definitions or command outcomes for business validation until they are available.

The bundled sample compiles with standard decorators. For native Node ESM, use TypeScript 7 with `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "Bundler"`, and `lib: ["ES2022", "DOM", "ESNext.Decorators"]`; keep `.js` extensions on relative imports. The installed Fundamentals 7.19.3 declaration barrel uses extensionless imports and does not type-check as a NodeNext consumer, although its ESM runtime imports in Node. This is a compiler compatibility limit, not a wire-format choice.
