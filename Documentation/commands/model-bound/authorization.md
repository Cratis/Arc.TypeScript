---
title: Command authorization
description: Restrict a model-bound command with @roles, @authorize, and @allowAnonymous, and know how stacked declarations combine.
---

Put access rules on the command class. Arc checks them before it validates the input, so a caller who may not run the command never sees its rule messages.

```typescript
import { field } from '@cratis/fundamentals';
import { authorize, command, roles } from '@cratis/arc.core';

@command()
@roles('Editor', 'Admin')
export class ArchiveTask {
    @field(String) id!: string;
    handle(): void { /* archive the task */ }
}

@command()
@authorize({ policy: 'Finance' })
export class ApproveBudget {
    @field(String) id!: string;
    handle(): void { /* approve */ }
}
```

| Decorator | Requirement |
| --- | --- |
| None | Everyone, including anonymous callers |
| `@authorize()` | Any authenticated caller |
| `@roles('Editor', 'Admin')` | An authenticated caller with at least one of the roles |
| `@authorize({ policy: 'Finance', roles: [...] })` | A registered [policy](../../core/authorization.md) accepts the caller, plus any listed role |
| `@authorize({ schemes: ['Verified'] })` | A principal authenticated by the named [scheme](../../core/authorization.md#select-an-authentication-scheme) |
| `@allowAnonymous()` | Everyone, stated explicitly |

## Combine declarations

- Roles within one declaration are alternatives: `@roles('Editor', 'Admin')` allows either.
- Stacked decorators are separate requirements, and **all** must pass: `@authorize({ policy: 'Finance' })` plus `@roles('Admin')` requires both.
- `@allowAnonymous()` cannot share a declaration with an authenticated requirement; startup rejects the combination.

## Where decorators may go

Authorization belongs on the command class. On `handle()` or `provide()`, it would protect nothing, so the build fails instead of leaving the endpoint open.

## When the answer depends on the input

A decorator cannot see which task the caller wants to archive. For per-input or per-tenant decisions, the low-level `authorize(input, context)` callback runs after the schema and before validation; see [Authorizing commands and queries](../../authorizing-commands-and-queries.md#decide-per-request). For a model-bound command, a check that needs stored data can deny from `provide()` with `denied(reason)`; see [Command outcomes](../command-outcomes.md).

## Related

- [Authorizing commands and queries](../../authorizing-commands-and-queries.md)
- [Authentication](../../core/authentication.md)
