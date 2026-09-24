---
title: Command execution scopes
description: Run code around provide() and handle() of a low-level command, such as a unit of work or timing, and know exactly when each scope begins and completes.
---

Some work belongs around a command rather than inside it: opening and committing a unit of work, or measuring how long the handler took. An execution scope runs `begin` before `provide()` and `handle()`, and `complete` after them, with the result so far.

## Add a scope

Scopes are declared on low-level definitions with `scopes`, a list of factories. Arc creates new scope objects for every execution:

```typescript
import { defineCommand, type CommandExecutionScope } from '@cratis/arc.core';
import { z } from 'zod';

const timing = (): CommandExecutionScope => {
    let started = 0;
    return {
        begin: () => { started = performance.now(); },
        complete: (context, result) => {
            console.log(context.correlationId, result.isSuccess, performance.now() - started);
        }
    };
};

export const archive = defineCommand({
    name: 'Archive',
    namespace: 'Tasks',
    schema: z.object({ id: z.string() }),
    scopes: [timing],
    handle: ({ id }) => ({ id })
});
```

## How scopes run

1. Arc creates each scope and records it before calling its `begin`, in list order. If a `begin` throws, no later scope begins, `provide` and `handle` do not run, and the command fails with a 500.
2. `provide` and `handle` run.
3. Every recorded scope completes exactly once, in reverse order, with the result so far. That includes a scope whose `begin` threw, so `complete` must cope with a partly started scope.
4. If any `complete` throws, the command fails with a 500 and the response is removed from the result, even when `handle` succeeded.

Scopes do not run for the validation-only route or when authorization or validation fails.

Arc does not make a scope transactional: whether `complete` commits or rolls back is your code's decision, and it can read `result.isSuccess`. When the command returns [operations](operations/index.md), a scope that commits business changes must also report explicit commit facts before Arc considers compensation; see [Implementing operations](operations/implementing.md#report-whether-the-business-change-committed).

## Model-bound commands

`@command()` classes do not declare scopes. To wrap every validated model-bound command execution, register a runner with `builder.addCommandExecutionRunner((context, execute) => ...)` or the `commandExecutionRunner` option; it receives the `CommandContext` and a function that runs the rest of the command and returns its `CommandResult`. Integrations use this to set up ambient state for the whole execution. A runner is not a commit participant for operations.

## Related

- [Command outcomes](command-outcomes.md)
- [Command pipeline](command-pipeline.md)
- [Low-level definitions](low-level-definitions.md)
