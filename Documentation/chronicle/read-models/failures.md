---
title: When read model resolution fails
description: Every failure a command-scoped read model can produce, what the caller sees, what it means, and how to fix it.
---

A command that loads a read model can fail for two different kinds of reasons. The request can be wrong: no usable key, or an entity that does not exist. The application can be wrong: a read model no integration owns, or a lookup outside a validator. Arc keeps the two apart. Wrong input answers 400 with a validation result, and a misconfiguration fails loudly instead of posing as a missing entity.

| Message | Cause | Caller sees |
| --- | --- | --- |
| `A command key is required for <Type>` | The command has no usable key | 400 |
| `<Type> was not found for the command key` | The key is valid, but a required read model does not exist | 400 |
| `Expected one read-model resolver for <Type>, found 0` | No integration owns the type | `build()` fails |
| `Expected one read-model resolver for <Type>, found 2` | Two integrations claim the type | `build()` fails |
| `Command read models can only be resolved during command validation` | `readModelForValidation` was called outside a running validator | The call throws |

Both 400 answers carry one validation result with error severity, reason `rule`, and no members. The command's own code does not run.

## A command key is required

The command resolved no key, so there is nothing to look the read model up by. The key comes from `getEventSourceId()`, a `getKey()` method, or a `@key()` field; see [Resolving the event source ID](../resolving-event-source-id.md). An empty string counts as no key.

Making the parameter optional does not help: `commandReadModel(Type, { optional: true })` still rejects a command without a key, because the lookup cannot be performed at all.

:::note[A keyless command still appends]
A Chronicle command with no key appends its events to a new UUID. That UUID is created when the events are appended, after the read model would have been loaded, so it never serves as a lookup key. A command that works on an existing entity must declare that entity's key.
:::

**Fix:** declare the key on the command.

## Not found for the command key

The key is valid, no instance exists for it, and the parameter is required. Arc treats this as invalid input: the command targets an entity that is not there.

**Fix:** pick the one that matches your intent.

- **Absence is a business condition.** Declare `commandReadModel(Type, { optional: true })`, or read it with `readModelForValidation(Type, { optional: true })` in a validator, and write the rule around `null`. You get your own message instead of the generic one.
- **The state is required.** Keep the parameter required. The 400 is the intended behavior.

A projection runs after the event is appended. A command sent straight after the event that creates the entity can arrive before the read model exists. For a rule that must hold regardless of timing, use a Chronicle constraint.

## No owner, or two owners

`build()` checks every `commandReadModel(Type)` binding in `handle()` and `provide()` before the application serves anything. A type needs exactly one owner:

- **Chronicle** owns a type that is a read model in its catalog: projected with `@fromEvent` or another projection decorator, or targeted by a projection or reducer, and registered through `discover()` or `add()`. Discovery can run before or after `withChronicle`; a class not registered at all is not in the catalog.
- **MongoDB** owns a type listed in `withMongoDB({ readModels })`.
- An application can add its own `ReadModelForCommandResolver` with `builder.addReadModelForCommandResolver(...)`.

Two owners fail too, instead of one silently winning. Remove the type from one integration.

`readModelForValidation` is resolved when the validator runs, not at `build()`. A missing owner there makes the rule throw, and the caller gets a 400 with reason `validatorFailed`.

## Outside a validator

`readModelForValidation` reads the key and tenant from the validator that is running. Called anywhere else, such as in `handle()` or a query, it has no command to read from and throws. Use `commandReadModel(Type)` in `handle()` and `provide()`.

## Related

- [Read models in commands](injecting-into-commands.md)
- [Command validation](../../commands/command-validation.md)
- [Diagnostics](../../reference/diagnostics.md)
