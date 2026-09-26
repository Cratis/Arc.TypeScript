---
title: Authorizing commands and queries
description: Restrict commands and queries by authentication, role, policy, or per-request decision, and see which status each check answers and in what order.
---

A command that renames a task has to answer several questions before it touches anything: who is calling, may they call this at all, may they change this particular task, and is the input valid? Arc gives each question its own place and always asks them in the same order, so a caller the declarations turn away never sees the command's rule messages.

## Declare who may call

Put the rule on the command class or the read model as a decorator:

| Decorator | Who may call |
| --- | --- |
| None | Everyone, including anonymous callers |
| `@authorize()` | Any authenticated caller |
| `@roles('editor', 'admin')` | An authenticated caller with at least one of the roles |
| `@authorize({ policy: 'Finance' })` | A caller the registered [policy](core/authorization.md) accepts |
| `@authorize({ schemes: ['Verified'] })` | A principal authenticated by the named [scheme](core/authorization.md#select-an-authentication-scheme) |
| `@allowAnonymous()` | Everyone, stated explicitly |

- Roles in one declaration are alternatives; stacked declarations must **all** pass.
- On a read model, an explicit `@query()` method declaration replaces the class declaration; without one, the method inherits the class declaration.
- Combining anonymous access with an authenticated requirement is a contradiction, and startup throws.
- Declare command authorization on the class. Any authorization decorator on a command method (`handle()`, `provide()`, or a helper), or on a static method without `@query()`, fails at build instead of silently having no effect.

See [Command authorization](commands/model-bound/authorization.md) for more command examples.

## A command with every check

This command requires the `editor` role, validates the title, and lets only the task's owner in the current tenant rename it. The bearer token is a fixed development value, not real token verification.

```typescript title="tasks.ts"
import { field } from '@cratis/fundamentals';
import {
    ArcApplication, AuthenticationStatus, command, commandContext, CommandValidator, denied, inject,
    rejected, roles, validation, validator, type AuthenticationHandler, type CommandContext
} from '@cratis/arc.core';

interface Task { id: string; tenant: string; owner: string; title: string }
const tasks = new Map<string, Task>();

@command({ namespace: 'Tasks' })
@roles('editor')
export class Rename {
    @field(String) id!: string;
    @field(String) title!: string;

    @inject(commandContext())
    provide(context: CommandContext) {
        const task = tasks.get(this.id);
        if (!task) return rejected(validation('The task does not exist', ['id'], 'notFound'));
        const owned = context.tenantId !== undefined && task.tenant === context.tenantId && task.owner === context.principal?.id;
        return owned ? task : denied('Only the owner can rename a task');
    }

    handle(task: Task) {
        task.title = this.title;
        return { id: task.id };
    }
}

@validator(Rename)
export class RenameValidator extends CommandValidator<Rename> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
    }
}

// Development only: fixed tokens instead of real token verification.
const developmentUsers = new Map([['ada-dev-token', { id: 'ada', roles: ['editor'] }]]);

const bearerToken: AuthenticationHandler = request => {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return { status: AuthenticationStatus.Anonymous };
    const user = developmentUsers.get(header.slice('Bearer '.length));
    if (!user) return { status: AuthenticationStatus.Failed };
    return { status: AuthenticationStatus.Authenticated, principal: { ...user, isAuthenticated: true } };
};

const builder = ArcApplication.createBuilder({ authentication: [bearerToken] });
builder.add(Rename, RenameValidator);
export const app = await builder.build();
```

With one task owned by `ada` in tenant `acme` and one owned by someone else, `POST /api/tasks/rename` answers:

| Request | Status | Why |
| --- | --- | --- |
| No `Authorization` header | 401 | The command requires a role and nobody is authenticated |
| An unknown bearer token | 401 | The handler returned `Failed` |
| Ada's token, no `x-cratis-tenant-id` header | 403 | `provide()` returned `denied(...)`; the reason is in `authorizationFailureReason` |
| Ada's token, tenant `acme`, someone else's task | 403 | `provide()` returned `denied(...)` |
| Ada's token, tenant `acme`, a title of spaces | 400 | The validator returned a result for `title` |
| Ada's token, tenant `acme`, an unknown task ID | 400 | `provide()` returned `rejected(...)` with reason `notFound` |
| Ada's token, tenant `acme`, her own task, a new title | 200 | `response` is `{ "id": ... }` |

`provide()` runs after validation, so an editor who sends a title of spaces for someone else's task gets 400 with the rule message, not 403. When a per-input decision must come before validation, use a low-level definition's `authorize` callback, described in [Decide per request](#decide-per-request).

The full order of stages is on [Command pipeline](commands/command-pipeline.md); queries follow the same order, described on [Query pipeline](queries/query-pipeline.md).

## Status codes

- 401 answers an anonymous caller on a protected operation when at least one authentication handler is configured, and any request whose handler returned `Failed`. Arc on .NET answers 403 for the anonymous case; this is a [deliberate difference](reference/capabilities.md#deliberate-differences).
- 403 answers a known caller who does not meet a declaration, a per-request `authorize` that returned `false`, or `denied(...)`.
- Unparseable JSON is rejected with 400 before the role check, so an authenticated caller without the role gets 400 for a malformed body and 403 for a well-formed one.

## Queries: roles and ownership

A model-bound query takes the same decorators on its read-model class or on a `@query()` method. An explicit method declaration replaces the class's entirely: `@roles('Reader')` on a method of an `@roles('Admin')` class permits Reader, not Admin. Without method decorators, the class declaration applies. A denied caller never reaches the query method and gets `isAuthorized: false`.

A role answers "may this caller use the query at all", not "which rows may they see". `@roles('Planner')` on `allTasks` lets every planner read every task. When a read is owner-scoped, make ownership part of the query itself: read the caller's identity with `currentContext()` from `@cratis/arc.core` and put it in the data source's filter, next to the requested ID. When the caller has no identity, deny the query; never drop the owner filter to make it work. [Observable queries](queries/observable-queries.md#authorize-a-live-query) shows an owner-filtered live query.

For a cross-cutting query rule, use a scoped [authorization query filter](queries/query-filters.md) instead of repeating it on each query. It runs after declared authorization and argument binding, before validators or performer dependencies; `unauthorizedQueryResult(context)` answers 403 without a reason or validation details. Snapshot GET/`QUERY` and direct or hub subscriptions use the same admission pipeline. For a live query, authorization filters run once when the subscription opens. A role removed later does not close a running subscription; use an [emission guard](queries/observable-query-emission-guards.md) when access must be re-checked on every emission.

## Keep security out of validators

Put every security and tenant check in a declaration, a policy, `provide()`, or `authorize`, never in a validator. A trusted direct caller can lower the blocking severity, but nothing lowers authorization or `denied(...)`.

## Test who may call

Authorization is easy to break silently: a moved decorator or a new command without one leaves an operation open, and nothing fails. Specify it like any other behavior. A scenario's `withContext({ principal })` sets the caller, and `shouldNotBeAuthorized()` and `shouldBeAuthorized()` assert the verdict. [Testing commands](testing/commands.md#test-authorization) shows the specs for an anonymous caller, a caller without the role, and a caller with it.

## Decide per request

A decorator cannot see which task the caller wants. A model-bound command makes that decision in `provide()` by returning `denied(reason)`, which answers 403 with the reason, as the example above does; see [Command outcomes](commands/command-outcomes.md).

A low-level definition adds `authorize(input, context)` instead. It runs after the schema and before validation, receives the typed input, and returns `true` or `false`, or a promise of either. `false` answers 403 without a reason. Nothing a caller sends, and no allowed severity, changes its outcome.

## Low-level definitions

`defineCommand` and `defineQuery` take an `authorization` property instead of decorators:

| Decorator | Low-level `authorization` |
| --- | --- |
| None | None |
| `@authorize()` | `{ authenticated: true }` |
| `@roles('editor', 'admin')` | `{ roles: ['editor', 'admin'] }` |
| `@authorize({ policy: 'Finance' })` | `{ policy: 'Finance', authenticated: true }` |
| `@authorize({ schemes: ['Verified'] })` | `{ schemes: ['Verified'], authenticated: true }` |
| `@allowAnonymous()` | `{ anonymous: true }`; a per-request `authorize` callback still runs |

The same rename as a low-level command, with the ownership check in `authorize`:

```typescript title="low-level-tasks.ts"
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

It answers the same statuses as the model-bound command, with two differences. Its 403 responses carry no reason, because `authorize` returns only `false`. And a title of spaces on someone else's task answers 403, not 400, because `authorize` runs before `validate`.

## Related

- [Authentication](core/authentication.md)
- [Authorization policies and schemes](core/authorization.md)
- [Tenancy](tenancy/index.md)
