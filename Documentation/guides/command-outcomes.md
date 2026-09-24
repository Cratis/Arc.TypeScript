---
title: Decide command outcomes
description: Load data in provide, reject or deny from provide and handle with Arc's outcome helpers, and wrap commands in execution scopes.
---

Validation answers whether input follows the rules. Some decisions need more: whether the task exists, whether the caller may change it after it has been loaded, or whether something must happen around the handler, such as opening and committing a unit of work. `provide`, `handle`, and execution scopes are where those decisions go.

## Load data and decide in provide and handle

`provide(input, context)` runs after validation and before `handle`. Its return value decides what happens next:

| `provide` returns | Result |
| --- | --- |
| `response(value)` or any other value | `handle` runs and receives the value as its third argument |
| `rejected(...results)` | 400 with the results that are above the allowed severity; `handle` does not run |
| `denied(reason?)` | 403 with `authorizationFailureReason` set; `handle` does not run |

The provided value is typed `unknown` in `handle`, so narrow or cast it, as [the rename example](validation-and-authorization.md#a-command-with-every-check) does with `provided as Task`.

`handle` uses the same helpers. Any value or `response(value)` becomes the result's `response`, `rejected(...)` answers 400, and `denied(...)` answers 403. If `provide` or `handle` throws, the result is a 500. Outside development mode the HTTP result carries `An unexpected error occurred` and no stack trace; [Configure the server](configuration.md#control-error-details) shows how to log the original.

## Outcomes are recognized by origin, not by shape

Arc treats a value as an outcome only when `response`, `rejected`, or `denied` created it. The helpers mark their values with a private symbol, so application data that happens to have a `kind` property, such as `{ kind: 'denied', value: 1 }`, is an ordinary response. To check a value yourself, use `isOutcome(value)`, which recognizes only helper-created outcomes.

`rejected()` needs at least one validation result and throws without one, so an empty rejection can never be mistaken for success. The throw becomes a 500 and `handle` does not run.

Results passed to `rejected(...)` go through the same severity filter as validators; see [Choose how strict warnings are](validation-and-authorization.md#choose-how-strict-warnings-are). When nothing above the allowed severity remains:

- from `provide`, `handle` runs and receives `undefined` as the provided value;
- from `handle`, the command succeeds without a `response`.

## Wrap handlers in execution scopes

A scope runs code around `provide` and `handle`, for example to open and commit a unit of work or to measure time. `scopes` takes a list of factories, and Arc creates new scope objects for every execution:

```typescript
import { defineCommand } from '@cratis/arc.server';
import type { CommandExecutionScope } from '@cratis/arc.server';
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

How scopes run:

1. Arc creates each scope and records it before calling its `begin`, in list order. If a `begin` throws, no later scope begins and `provide` and `handle` do not run; the command fails with a 500.
2. `provide` and `handle` run.
3. Every recorded scope completes exactly once, in reverse order, with the result so far. That includes a scope whose `begin` threw, so `complete` must cope with a partly started scope.
4. If any `complete` throws, the command fails with a 500 and the response is removed from the result, even when `handle` succeeded.

Scopes do not run for the validation-only route or when authorization or validation fails. Arc does not make a scope transactional: whether `complete` commits or rolls back is up to your code, which can read `result.isSuccess`.

## Related

- [Validate and authorize commands and queries](validation-and-authorization.md)
- [Call Arc from code](direct-calls.md)
- [Capability reference](../reference/capabilities.md)
