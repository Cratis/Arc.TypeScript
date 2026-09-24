---
title: Validation rules in proxies
description: Which @validator rules the proxy generator copies into client validators, which stay on the server, and why the server still checks every request.
---

A frontend form should show "A title is required" before the user presses submit. The generator copies the rules it can evaluate safely in the browser from your server validators into the generated proxies. The server still validates every request, so a skipped client rule never weakens the contract.

## What is copied

The generator reads literal, unconditional `ruleFor` chains in the constructors of `@validator(Target)` classes and emits them for:

- commands, including rules on direct concept fields;
- query arguments, when the query declares an explicit `argumentsModel`.

For the Tasks sample, the generated `RegisterTaskValidator` contains:

```typescript
this.ruleFor(c => c.title).notEmpty().withMessage('A title is required');
this.ruleFor(c => c.title).maxLength(100).withMessage('A title can have at most 100 characters');
```

The client-safe rules are `notNull`, `notEmpty`, `minLength`, `maxLength`, `length`, `emailAddress`, `phone`, `url`, `matches`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, and `lessThanOrEqual`, with their messages.

## What stays on the server

Conditions (`when`, `unless`), predicates (`must`, `mustAsync`), and any rule that needs runtime evaluation stay on the server and produce a source diagnostic, so you know the client will not check them. The `TaskTitleValidator` concept rule in the sample uses `must` and is therefore server-only.

## Related

- [Command validation](../commands/command-validation.md)
- [Query validation](../queries/validation.md)
