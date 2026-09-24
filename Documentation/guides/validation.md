---
title: Validate model-bound commands and queries
description: Keep shape checks at the wire boundary and give callers field-specific rules with model and concept validators.
---

A task title arrives as a string, but it should not be blank. Put the wire type on the command field, then give the business rule its own validator. Arc runs that validator before `handle()` and also on the command's `/validate` route.

:::caution[Unpublished source]
Arc for TypeScript is not published to npm. The validator API is implemented in this repository, but FluentValidation's full .NET rule set and generated client rules are not available. See the [capability reference](../reference/capabilities.md).
:::

## Add a command rule

The [Tasks sample](../../Samples/Tasks/Features/Tasks/Registration/RegisterTaskValidator.ts) declares a validator beside `RegisterTask`:

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

`@validator(RegisterTask)` supplies the runtime target that TypeScript's erased generic cannot. It does not register anything globally. The sample calls `builder.discover(...)` on its Features folder; for an explicit catalog, call `builder.add(RegisterTask, RegisterTaskValidator)`. One validator may target each exact model class. Duplicate targets fail at build time.

Send `{ "id": "<valid task UUID>", "title": "" }` to `POST /api/tasks/registration/register-task/validate` in a running Tasks sample. The response is 400 with `members: ["title"]`, `reason: "rule"` and the authored message; `handle()` does not run. A type mismatch, missing required field, or malformed JSON fails earlier with `malformedRequest`, not a rule message. The route depends on discovery namespace; inspect `/.cratis/commands` if you configure a different namespace or route.

## Apply a concept rule everywhere

When a value has rules wherever it appears, declare a `ConceptValidator`. The [sample title validator](../../Samples/Tasks/Features/Tasks/TaskTitleValidator.ts) uses `ruleFor(title => title.value)`; Arc traverses declared `@field` members and runs the concept validator on any encountered `TaskTitle`, including nested models and arrays. A failure inside `entries[]` reports `entries.title`, not an array index. The owning model's rule still runs independently. To omit only the *direct* member's concept validator, call `.ignoreConceptRules()` on its owner's `ruleFor(...)` chain; this does not stop descendant traversal.

## Check a query's arguments together

Give the query an `argumentsModel` with matching `@field` declarations, and target that class with `QueryValidator<SearchArguments>`. Declare it alongside the ordered argument descriptors:

```typescript
@query({ argumentsModel: SearchArguments }, argument('term', SearchTerm))
static byTerm(term: SearchTerm): string { return term.value; }
```

The [executable example](../../Source/Arc.Core/validation/for_ModelGraphValidator/given/Search.ts) shows the surrounding read model. The query model validator runs once, then Arc visits its fields for concept validators. Without an arguments model, the query validates each supplied non-null argument's concept graph under that argument name. Queries ignore `X-Allowed-Severity`.

## Use services or asynchronous rules

A validator may declare constructor dependencies through `@injectable(Service)` or `static inject = [Service] as const`. Register the service with `builder.services`; Arc preflights dependencies and constructs each validator once during build, catching invalid selectors before requests. It then resolves fresh validators and services in each execution scope. `must` and `mustAsync` receive `(value, model, signal)`. Pass the signal to cancelable I/O rather than starting an operation that outlives the request. `when(predicate)` and `unless(predicate)` condition **every rule on the chain** by default. Pass `ApplyConditionTo.CurrentValidator` as the second argument to condition only the latest rule. These predicates and async rules run only on the server.

Available client-vocabulary rules are `notNull`, `notEmpty`, `minLength`, `maxLength`, `length`, `emailAddress`, `phone`, `url`, `matches`, `greaterThan`, `greaterThanOrEqual`, `lessThan` and `lessThanOrEqual`. Server-only rules include `empty`, `null`, `equal`, `notEqual`, `inclusiveBetween`, `exclusiveBetween`, `must` and `mustAsync`. `withMessage`, `withSeverity` and `withState` decorate the last rule; state is included in the HTTP result when it is non-null. Rules have internal immutable descriptors, but **no model-bound rule is emitted into a client proxy yet**. Rules on concept members receive the unwrapped primitive (for example, `TaskTitle` rules accept a `string`); string rules are only available for strings and comparison rules only for numbers or temporal values. `notEmpty()` rejects `Guid.empty`, while `equal()` and `notEqual()` compare GUID and temporal values by value. Email, phone, URL, regex, default messages and Unicode length semantics are not guaranteed to match FluentValidation or the JavaScript client exactly. For rules that matter across runtimes, provide an explicit message and test the inputs you accept.

Commands retain results only when `severity > allowedSeverity`: by default errors block and warnings are removed. `X-Allowed-Severity: 1` makes warnings block. TypeScript caps HTTP threshold `3` at Warning, unlike Arc on .NET, so errors cannot be bypassed over HTTP. [Authentication and authorization](validation-and-authorization.md) run before the rules; never put access control in a validator. Existing `defineCommand` and `defineQuery` `validate`/`filters` continue to work as the low-level path.
