---
title: Command validation
description: Keep shape checks at the wire boundary and give callers field-specific messages with CommandValidator rules, services, and asynchronous checks.
---

A task title arrives as a string, but it must not be blank. The wire type goes on the command field; the business rule gets its own validator. Arc runs the validator before `handle()`, and on the command's `/validate` route, so a frontend can check input before submitting it.

## Add a command rule

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/Registration.ts) declares a validator beside `RegisterTask`:

```typescript
import { CommandValidator, validator } from '@cratis/arc.core';
import { RegisterTask } from './RegisterTask.js';

@validator(RegisterTask)
export class RegisterTaskValidator extends CommandValidator<RegisterTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
        this.ruleFor(command => command.title).maxLength(100).withMessage('A title can have at most 100 characters');
    }
}
```

`@validator(RegisterTask)` supplies the runtime target that TypeScript's erased generic cannot. It does not register anything globally: `builder.discover(...)` picks it up from the folder, or you pass it to `builder.add(RegisterTask, RegisterTaskValidator)`. One validator may target each exact model class; a duplicate target fails at build.

Send `{ "id": "<valid task UUID>", "title": "" }` to `POST /api/tasks/registration/register-task/validate` on the running sample. The answer is 400 with:

```json
{"severity":3,"message":"A title is required","members":["title"],"reason":"rule"}
```

`handle()` does not run. A type mismatch, missing required field, or malformed JSON fails earlier with `malformedRequest`, not a rule message.

## Shape or rule?

| Put it on the field | Put it in a validator |
| --- | --- |
| Types, required and optional fields, defaults | Business rules a user can fix, with a message and the member it concerns |
| Anything where failure means the client sent the wrong shape | Rules that need services or asynchronous checks |

A shape failure produces one result with reason `malformedRequest`, no message a user can act on, and no members. A rule that applies to a value wherever it appears, such as a title format, belongs in a [concept validator](../concepts.md#validate-a-concept-everywhere).

## Rule vocabulary

| Rules | Where they run |
| --- | --- |
| `notNull`, `notEmpty`, `minLength`, `maxLength`, `length`, `emailAddress`, `phone`, `url`, `matches`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` | Server; literal, unconditional uses are also emitted into [generated proxies](../proxy-generation/validation.md) |
| `empty`, `null`, `equal`, `notEqual`, `inclusiveBetween`, `exclusiveBetween`, `must`, `mustAsync` | Server only |

`withMessage`, `withSeverity`, and `withState` decorate the most recent rule; state is included in the HTTP result when it is not null.

- Rules on concept members receive the unwrapped primitive: `TaskTitle` rules accept a `string`.
- String rules are only available for strings, and comparison rules only for numbers and temporal values.
- `notEmpty()` rejects `Guid.empty`; `equal()` and `notEqual()` compare GUID and temporal values by value.
- Email, phone, URL, regular-expression, default-message, and Unicode-length behavior is not guaranteed to match FluentValidation or the JavaScript client exactly. For rules that matter across runtimes, write an explicit message and test the inputs you accept.

## Conditions, services, and asynchronous rules

`when(predicate)` and `unless(predicate)` condition **every rule on the chain** by default. Pass `ApplyConditionTo.CurrentValidator` as the second argument to condition only the latest rule. `must` and `mustAsync` receive `(value, model, signal)`; pass the signal to cancelable I/O instead of starting work that outlives the request. Conditions and asynchronous rules run only on the server.

A validator may declare constructor dependencies with `@injectable(Service)` or `static inject = [Service] as const`. Register the service with `builder.services`. Arc preflights the dependencies and constructs each validator once during build, which catches invalid selectors before any request. It then resolves fresh validators and services in each execution scope.

Read models loaded by command key are not injected into validators. Make an explicit, tenant-scoped lookup in a rule when validation needs stored state.

## What validation is not

Authentication and authorization run before any rule, and a trusted direct caller can lower the blocking severity. Never put access control in a validator; see [Authorizing commands and queries](../authorizing-commands-and-queries.md). Which severities block is covered in [Validation severity filtering](validation-severity-filtering.md).

Low-level `defineCommand` and `defineQuery` definitions keep their `validate` and `filters` callbacks; see [Command filters](command-filters.md).

## Related

- [Query validation](../queries/validation.md)
- [Concepts](../concepts.md)
- [Testing commands](../testing/commands.md)
