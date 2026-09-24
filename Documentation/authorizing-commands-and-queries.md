---
title: Authorizing commands and queries
description: Restrict commands and queries by authentication, role, policy, or per-request decision, and see which status each check answers and in what order.
---

A command that renames a task has to answer several questions before it touches anything: who is calling, may they call this at all, may they change this particular task, and is the input valid? Arc gives each question its own place and always asks them in the same order, so a caller who may not run an operation never sees its rule messages.

## Declare who may call

On model-bound artifacts, use decorators. On low-level definitions, use the `authorization` property:

| Decorator | Low-level `authorization` | Who may call |
| --- | --- | --- |
| None | None | Everyone, including anonymous callers |
| `@authorize()` | `{ authenticated: true }` | Any authenticated caller |
| `@roles('editor', 'admin')` | `{ roles: ['editor', 'admin'] }` | An authenticated caller with at least one of the roles |
| `@authorize({ policy: 'Finance' })` | `{ policy: 'Finance', authenticated: true }` | A caller the registered [policy](core/authorization.md) accepts |
| `@authorize({ schemes: ['Verified'] })` | `{ schemes: ['Verified'], authenticated: true }` | A principal authenticated by the named [scheme](core/authorization.md#select-an-authentication-scheme) |
| `@allowAnonymous()` | `{ anonymous: true }` | Everyone; a per-request `authorize` callback still runs |

- Roles in one declaration are alternatives; stacked declarations must **all** pass.
- On a read model, a `@query()` method's declaration replaces the class declaration.
- Combining anonymous access with an authenticated requirement is a contradiction, and startup throws.
- Authorization on a command's `handle()`, or on a static method without `@query()`, fails at build instead of silently leaving the endpoint open.

See [Command authorization](commands/model-bound/authorization.md) for command examples.

## Decide per request

When the answer depends on the input, the tenant, or stored data, a low-level definition adds `authorize(input, context)`. It runs after the schema, receives the typed input, and returns `true` or `false`, or a promise of either. `false` answers 403 without a reason. Nothing a caller sends, and no allowed severity, changes its outcome. A model-bound command makes the same decision in `provide()` by returning `denied(reason)`, which answers 403 with the reason; see [Command outcomes](commands/command-outcomes.md).

## A command with every check

This low-level command is an illustration: the bearer token is a fixed development value, not real token verification.

```typescript title="tasks.ts"
import { ArcServer, AuthenticationStatus, defineCommand, rejected, response, validation } from '@cratis/arc.core';
import type { AuthenticationHandler } from '@cratis/arc.core';
import { z } from 'zod';

interface Task { id: string; tenant: string; owner: string; title: string }
const tasks = new Map<string, Task>();

// Development only: fixed tokens instead of real token verification.
const developmentUsers = new Map([['ada-dev-token', { id: 'ada', roles: ['editor'] }]]);

const bearerToken: AuthenticationHandler = request => {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return { status: AuthenticationStatus.Anonymous };
    const user = developmentUsers.get(header.slice('Bearer '.length));
    if (!user) return { status: AuthenticationStatus.Failed };
    return { status: AuthenticationStatus.Authenticated, principal: { ...user, isAuthenticated: true } };
};

const rename = defineCommand({
    name: 'Rename',
    namespace: 'Tasks',
    schema: z.object({ id: z.string(), title: z.string() }),
    authorization: { roles: ['editor'] },
    authorize: ({ id }, context) => {
        if (!context.tenantId) return false;
        const task = tasks.get(id);
        return !task || (task.tenant === context.tenantId && task.owner === context.principal?.id);
    },
    validate: ({ title }) => title.trim() ? [] : [validation('A title is required', ['title'])],
    provide: ({ id }) => {
        const task = tasks.get(id);
        return task ? response(task) : rejected(validation('The task does not exist', ['id'], 'notFound'));
    },
    handle: ({ title }, _context, provided) => {
        const task = provided as Task;
        task.title = title;
        return { id: task.id };
    }
});

export const arc = new ArcServer({ commands: [rename], authentication: [bearerToken] });
```

With one task owned by `ada` in tenant `acme` and one owned by someone else, `POST /api/tasks/rename` answers:

| Request | Status | Why |
| --- | --- | --- |
| No `Authorization` header | 401 | The command requires a role and nobody is authenticated |
| An unknown bearer token | 401 | The handler returned `Failed` |
| Ada's token, no `x-cratis-tenant-id` header | 403 | `authorize` returned `false` |
| Ada's token, tenant `acme`, someone else's task | 403 | `authorize` returned `false` |
| Ada's token, tenant `acme`, a title of spaces | 400 | `validate` returned a result for `title` |
| Ada's token, tenant `acme`, an unknown task ID | 400 | `provide` returned `rejected(...)` with reason `notFound` |
| Ada's token, tenant `acme`, her own task, a new title | 200 | `response` is `{ "id": ... }` |

The full order of stages is on [Command pipeline](commands/command-pipeline.md); queries follow the same order, described on [Query pipeline](queries/query-pipeline.md).

## Status codes

- 401 answers an anonymous caller on a protected operation when at least one authentication handler is configured, and any request whose handler returned `Failed`. Arc on .NET answers 403 for the anonymous case; this is a [deliberate difference](reference/capabilities.md#deliberate-differences).
- 403 answers a known caller who does not meet a declaration, a per-request `authorize` that returned `false`, or `denied(...)`.
- Unparseable JSON is rejected with 400 before the role check, so an authenticated caller without the role gets 400 for a malformed body and 403 for a well-formed one.

## Keep security out of validators

Put every security and tenant check in authorization, never in a validator: a trusted direct caller can lower the blocking severity, but nothing lowers authorization.

## Related

- [Authentication](core/authentication.md)
- [Authorization policies and schemes](core/authorization.md)
- [Tenancy](tenancy/index.md)
