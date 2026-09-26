---
title: Command validation
description: Give callers field-specific messages with CommandValidator rules, choose the phase where each rejection belongs, and read stored state in a rule with readModelForValidation.
---

A task title arrives as a string, but it must not be blank, and a rename to the same title is pointless. If those checks live inside `handle()`, a form cannot ask about them before the user presses Save, and every handler grows its own error format. Arc gives rules a place of their own: a validator runs before `handle()`, answers with a message for the exact field, and also runs on the command's `/validate` route, so a frontend can check input without changing anything.

## Add a command rule

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/Registration.ts) keeps its validator in the same file as `RegisterTask`, so the imports it needs are the Arc ones:

```typescript title="Features/Tasks/Registration/Registration.ts (excerpt)"
import { command, CommandValidator, validator } from '@cratis/arc.core';

// RegisterTask is declared above in the same file.
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

Here is what happened. Arc bound the body to a `RegisterTask`, ran every validator for the command and for the concepts on its fields, and collected all their results. A failure does not stop the other rules, so a form can show every problem at once. Because a result was above the allowed severity, Arc answered 400 and never reached `handle()`. A type mismatch, a missing required field, or malformed JSON fails earlier with `malformedRequest` and no rule message.

## Construct validation results

Use `ValidationResult.information`, `ValidationResult.warning`, or `ValidationResult.error` when a low-level validator or a command outcome needs a result at a specific severity. The optional second argument carries members and rule-author-owned state; `reason` defaults to `rule`. Use `reasonDetail` to identify a specific rejection without parsing its message. The existing `validation(message, members?, reason?, severity?)` helper remains available.

```typescript title="validation-results.ts"
import { defineCommand, ValidationResult } from '@cratis/arc.core';
import { z } from 'zod';

export const save = defineCommand({
    name: 'Save',
    schema: z.object({ title: z.string() }),
    validate: ({ title }) => title.trim() ? [] : [
        ValidationResult.error('A title is required', {
            members: ['title'], state: { attempted: title }, reasonDetail: 'TitleRequired'
        })
    ],
    handle: () => undefined
});
```

`state` and `reasonDetail` reach the HTTP validation result for commands and queries when supplied; absent optional fields are omitted. The installed `@cratis/arc` client models these fields and the open-ended string `reason` on its validation results. Treat `state` as application-owned, JSON-serializable data: responses are serialized with `JSON.stringify`, so a `Map` or `Set` becomes `{}`, a class instance arrives as a plain object without its prototype (or as its `toJSON()` output), and a `bigint` fails serialization.

## Choose where to reject

Validators are one of several places a command can say no. Each place sees different information and runs at a different moment, so the right one depends on what the decision needs:

| The decision depends on | Put it in | Runs on `/validate` | Caller sees |
| --- | --- | --- | --- |
| The request's shape: types, required and optional fields | `@field` declarations | Yes | 400 `malformedRequest`, no message or members |
| Who is calling | `@roles`, `@authorize`, or a policy | Yes | 401 or 403 |
| One value, wherever it appears (a title format) | A [concept validator](../concepts.md#validate-a-concept-everywhere) | Yes | 400 with your message and member |
| The command's own fields, or a service | A `CommandValidator` rule | Yes | 400 with your message and member |
| Stored state for the entity the command is about | A `CommandValidator` rule that calls `readModelForValidation` | Yes | 400 with your message and member |
| Data you load anyway to do the work (the task must exist, the caller must own it) | `provide()` returning `rejected(...)` or `denied(...)` | No | 400 or 403 |
| A decision only the handler can make | `handle()` returning `rejected(...)` or `denied(...)` | No | 400 or 403 |

Two rules of thumb pick the row:

- **Reject as early as the information allows.** Everything down to the readModelForValidation row runs on `/validate`, so a form gets the message before submitting. `provide()` and `handle()` run only on execution.
- **Keep access control out of validators.** A trusted direct caller can lower the blocking severity, which lets validation results through; nothing lowers authorization or `denied(...)`. See [Authorizing commands and queries](../authorizing-commands-and-queries.md).

A check against stored state tells you what was true when it ran. Another request can change that state before `handle()` runs, so enforce a rule that must hold under concurrency at the storage boundary that performs the change, not only in a validator. [Command outcomes](command-outcomes.md) covers `rejected` and `denied`; [Model-bound commands](model-bound/index.md#prepare-data-in-provide) shows `provide()`.

## Read stored state in a rule

"The task already has this title" needs the stored task. A rule can read the read model that belongs to the command's key with `readModelForValidation(Type)` from `@cratis/arc.core`:

```typescript title="RenameTask.ts"
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, key, readModelForValidation, validator } from '@cratis/arc.core';
import { TaskView } from './TaskView.js';

@command()
export class RenameTask {
    @field(String) @key() id!: string;
    @field(String) title!: string;

    handle(): void {
        // Rename the task in your storage.
    }
}

@validator(RenameTask)
export class RenameTaskValidator extends CommandValidator<RenameTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).mustAsync(async title => {
            const current = await readModelForValidation(TaskView, { optional: true });
            return current === null || current.title !== title;
        }).withMessage('The task already has this title');
    }
}
```

`TaskView` is your read model, with at least a string `title` field. Arc does not load it itself; a registered read-model resolver does. The [MongoDB](../mongodb/index.md) and experimental [Chronicle](../chronicle/read-models/index.md) integrations register resolvers for the models you configure, and `builder.addReadModelForCommandResolver(token)` adds your own, as described in [Command context](command-context.md#load-a-read-model-by-key).

What happens when the rule runs:

- Arc resolves the command key from the `@key()` field and asks the resolver that owns `TaskView` for that key. The resolver also receives the command context, with the caller's tenant, so it can scope the lookup.
- `{ optional: true }` returns `null` when nothing is stored, so the rule decides what absence means. Here, a task that does not exist yet has no title to repeat. Without `optional`, a missing model makes the rule throw, and the caller gets reason `validatorFailed` instead of your message.
- Renaming task `t-1` from `Old` to `Old` answers 400 with `The task already has this title` for `title`, on both the execute and `/validate` routes. Renaming it to `New` succeeds.

`readModelForValidation` works only inside a validator of a model-bound command, during validation. Called anywhere else, it throws. Validators do not receive read models through their constructors.

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

A validator that throws, or whose dependency cannot be resolved, never reports success. The caller gets 400 with reason `validatorFailed` or `dependencyUnavailable`, no exception text, and the error goes to the configured logger.

## Low-level definitions

`defineCommand` and `defineQuery` do not use validator classes; they keep their `validate` and `filters` callbacks, which run in the same pipeline stage. See [Command filters](command-filters.md).

## Recap

Shape belongs on `@field`, a value's own rules on its concept, a command's rules in a `CommandValidator`, and access control in authorization. A rule that needs stored state reads it with `readModelForValidation`; a decision that needs the loaded data belongs in `provide()`. Everything up to validation also answers on `/validate`, which is what lets a form speak up before the user submits.

## Next step

[Validation severity filtering](validation-severity-filtering.md) explains which severities block and how a caller can let warnings through. To prove a rule in a spec, see [Testing commands](../testing/commands.md).
