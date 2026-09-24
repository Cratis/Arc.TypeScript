---
title: Validation severity filtering
description: Choose which validation severities block a command, per request, and why HTTP callers cannot let errors through.
---

Not every rule should stop a command. A warning such as "this title is unusually long" can inform the user without blocking them, while a form's final submit may want warnings to block. Arc lets the caller choose, within limits.

## Severities

Each validation result has a severity: `Unknown` (0), `Information` (1), `Warning` (2), or `Error` (3). Set it on a rule with `.withSeverity(Severity.Warning)`.

Results at or below the **allowed severity** are removed and do not block. Results above it block the command and are returned. The default allowed severity is `Warning`, so only errors block, and warnings and information are not returned.

## Who chooses

| Caller | Allowed severity |
| --- | --- |
| HTTP command | `X-Allowed-Severity` header of `0`, `1`, or `2`. A missing or invalid value means `2`. A value of `3` is capped to `2`, so errors always block. |
| HTTP query | Always `Warning`; the header is ignored |
| `executeCommand` from code | `context.allowedSeverity` as given, including `Severity.Error` |
| `performQuery` from code | Always `Warning` |

A client that sends `X-Allowed-Severity: 1` makes warnings block, and sees them in the result. Results passed to `rejected(...)` in `provide()` or `handle()` are filtered the same way; when nothing above the allowed severity remains, the command continues.

:::caution[A deliberate difference from Arc on .NET]
Arc on .NET 22.22.0 accepts `X-Allowed-Severity: 3` and runs a command whose only problems are errors. Arc for TypeScript caps HTTP requests at Warning, so a remote caller can never bypass business-rule errors. Only trusted code calling `executeCommand` can pass `Severity.Error`.
:::

## Consequences

- Severity never affects authorization. Put tenant and access checks in authorization, not in validators, because a trusted caller can lower the blocking severity.
- The paired conformance suite pins this difference; see the [capability reference](../reference/capabilities.md#deliberate-differences).

## Related

- [Command validation](command-validation.md)
- [Calling commands from code](calling-commands-from-code.md)
