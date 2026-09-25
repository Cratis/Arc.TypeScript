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

## Return more than one value

`tuple(first, second, ...)` returns several values from `handle()`. At most one of them may be the client response; every other value must be consumed on the server by a [response value handler](response-value-handlers.md), or the command fails. Ordinary arrays stay ordinary response values. A returned [command operation](operations/index.md) is one such server-side value.

## Related

- [Command pipeline](command-pipeline.md)
- [Command execution scopes](command-execution-scopes.md)
- [Command validation](command-validation.md)
