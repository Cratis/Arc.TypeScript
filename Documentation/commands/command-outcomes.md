---
title: Command outcomes
description: Return a response, reject with validation results, or deny from provide() and handle(), and know how Arc tells an outcome from ordinary data.
---

Validation answers whether input follows the rules. Some decisions can only be made later: whether the task exists, or whether the caller may change it once it has been loaded. `provide()` and `handle()` make those decisions with three outcome helpers from `@cratis/arc.core`.

## The helpers

| Return | Result |
| --- | --- |
| A plain value, or `response(value)` | Success; the value becomes the result's `response` |
| `rejected(...results)` | 400 with the results above the allowed severity; later steps do not run |
| `denied(reason?)` | 403 with `authorizationFailureReason` set; later steps do not run |
| Nothing | Success without a `response` |

`provide()` and `handle()` use the same helpers. From `provide()`, a value other than `rejected` or `denied` is passed to `handle()`; see [Model-bound commands](model-bound/index.md#prepare-data-in-provide) for a complete example. In a low-level definition, `provide(input, context)` receives the typed input, and `handle(input, context, provided)` receives the provided value typed as `unknown`, so narrow or cast it.

If `provide()` or `handle()` throws, the result is a 500. Unless `exposeExceptionDetails` is enabled, the HTTP result carries `An unexpected error occurred` and no stack trace; [Configuration](../configuration/index.md#errors-and-logging) shows how to log the original.

## Outcomes are recognized by origin, not by shape

Arc treats a value as an outcome only when `response`, `rejected`, or `denied` created it. The helpers mark their values with a private symbol, so application data that happens to have a `kind` property, such as `{ kind: 'denied', value: 1 }`, is an ordinary response. To check a value yourself, use `isOutcome(value)`.

`rejected()` needs at least one validation result and throws without one, so an empty rejection can never be mistaken for success. That throw becomes a 500.

Results passed to `rejected(...)` go through the same [severity filter](validation-severity-filtering.md) as validators. When nothing above the allowed severity remains:

- from `provide()`, `handle()` runs and receives `undefined` as the provided value;
- from `handle()`, the command succeeds without a `response`.

## Model several business outcomes

When a caller needs to distinguish, for example, a created task from one that already existed, return **one response DTO** with an application-owned status field. Both cases then have the same generated client type and decoder:

```typescript title="Features/Tasks/RegisterTask.ts"
import { field } from '@cratis/fundamentals';
import { command, response, type Outcome } from '@cratis/arc.core';

class RegistrationReply {
    @field(String) status!: string;
    constructor(status: string) { this.status = status; }
}

@command({ namespace: 'Tasks' })
export class RegisterTask {
    @field(String) taskId!: string;

    handle(): Outcome<RegistrationReply> {
        return response(new RegistrationReply(this.taskId === 'existing' ? 'alreadyExists' : 'created'));
    }
}
```

This illustration uses a fixture-like condition to select the status; replace it with your actual business decision. The HTTP envelope has a `response` such as `{ "status": "alreadyExists" }` and status 200 in either case. The status is your application data, not an Arc branch tag.

You can also return the DTO directly instead of calling `response()`. `Outcome<T>` lets you choose `response(value)`, `rejected(...)`, or `denied(...)` on different paths; it is **not** serialized as a discriminated union. A rejection produces a 400 validation envelope without a response, and a denial produces a 403 authorization envelope without a response. A business error DTO passed to `response()` is an ordinary **200 success response**, not a rejection. No branch index, `kind`, or other discriminator is added to the wire format.

The proxy generator accepts alternative paths through aliases, promises, and outcomes only if each has the same client-visible representation. It filters out values consumed by server-side handlers. It rejects different DTO constructors or cardinalities instead of choosing an arbitrary decoder; the diagnostic recommends one response DTO with an application-owned status field. This intentionally differs from Arc on .NET 22.23.0: .NET executes `OneOf<...>` and `Result<TSuccess, TError>` by unwrapping the selected value, but its generator picks a single response type and may misdecode another business branch. Do not rely on a client-visible union unless the client and generator both support its discriminant.

## Return more than one value

`tuple(first, second, ...)` returns several **simultaneous** values from `handle()`; it does not express alternative outcomes. At most one of them may be the client response; every other value must be consumed on the server by a [response value handler](response-value-handlers.md), or the command fails. Ordinary arrays stay ordinary response values. A returned [command operation](operations/index.md) is one such server-side value. Each alternative path is checked independently: a tuple path may contain server-handled values and one response.

## Related

- [Command pipeline](command-pipeline.md)
- [Command execution scopes](command-execution-scopes.md)
- [Command validation](command-validation.md)
