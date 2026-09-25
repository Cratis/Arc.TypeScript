---
title: Calling commands from code
description: Run a command or query from a job, a spec, or a Fetch API host, either through the full HTTP pipeline or directly with an execution context you supply.
---

Sometimes a command has to run without an HTTP client: an import job, a message consumer, an in-process spec, or a host that already speaks the Fetch API. `ArcServer`, available as `app.server`, has entry points for that. They differ in how much of the HTTP pipeline they run and in how much they trust the caller.

| Entry point | Runs | Trusts the caller with |
| --- | --- | --- |
| `handle(request, native?)` | The full HTTP pipeline | Nothing beyond an HTTP client |
| `executeCommand(name, input, context)` | Authorization, binding, validators, and the command | The whole execution context, including allowed severity |
| `execute(command, context)` | The same, for a decorated command instance | The same |
| `validateCommand(name, input, context)` | Authorization, binding, and validators, without `provide` or `handle` | The whole execution context |
| `validate(command, context)` | The same, for a decorated command instance | The same |
| `performQuery(name, input, context, options?)` | Authorization, binding, validators, and the query | The whole execution context, except allowed severity |

## Run a command and a query directly

This example uses the Tasks sample's classes, added explicitly:

```typescript
import { randomUUID } from 'node:crypto';
import { ArcApplication, Severity } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { RegisterTask } from './Features/Tasks/Registration/Registration.js';
import { TaskItem } from './Features/Tasks/Listing/Listing.js';

const builder = ArcApplication.createBuilder();
builder.services.addSingleton(Tasks);
builder.add(RegisterTask, TaskItem);
const app = await builder.build();

const context = {
    correlationId: randomUUID(),
    principal: { id: 'import-job', roles: ['system'], isAuthenticated: true },
    tenantId: 'acme',
    signal: AbortSignal.timeout(5_000),
    allowedSeverity: Severity.Warning
};
const result = await app.server.executeCommand('RegisterTask',
    { id: '1a638f8e-4444-4444-8888-a0b10cdd9977', title: 'Imported' }, context);
console.log(result.isSuccess, result.response);

const page = await app.server.performQuery('TaskItem.allTasks', {}, context, { paging: { page: 0, pageSize: 10 } });
console.log(page.data, page.paging);
await app.dispose();
```

The first log line is `true 1a638f8e-4444-4444-8888-a0b10cdd9977`; the query returns the imported task with `paging.totalItems: 1`.

## Find the operation by name

`executeCommand` and `performQuery` look an operation up by its full name and throw when nothing matches:

| Artifact | Full name |
| --- | --- |
| Model-bound command | Namespace and class name: `Tasks.Registration.RegisterTask` when discovered, `RegisterTask` when added without a namespace |
| Model-bound query | Namespace, read-model name, and method: `Tasks.Listing.TaskItem.allTasks` when discovered |
| Low-level definition | Namespace and name joined with a dot, such as `Tasks.Create`, or the bare name without a namespace |

If you already hold a decorated command instance, `app.server.execute(command, context)` serializes its decorated fields and runs the same pipeline; the registered command name must be unambiguous. Call `validateCommand(name, input, context)` or `validate(command, context)` to check authorization and validation without running the command, like the `/validate` route. `performQuery` takes paging and sorting as its fourth argument, for example `{ paging: { page: 0, pageSize: 10 }, sorting: { field: 'title', direction: 'asc' } }`.

## What a direct call does differently

- **You supply the context.** No authentication handler runs and no tenant is resolved. Authorization still runs against the principal and tenant you pass, so pass the real ones.
- **Allowed severity is yours to choose for commands.** `executeCommand` uses `context.allowedSeverity` as given, including `Severity.Error`, which lets error-severity validation results pass. HTTP callers cannot do that. Only pass it from code entitled to override business rules. `performQuery` always uses `Severity.Warning`.
- **The context is ambient.** Arc freezes a copy of your context and makes it available through `currentContext()` during the call. A nested call gets its own context, and the outer one is restored when it returns.
- **Nothing is redacted or logged.** Exception messages and stack traces stay in the result, and the `logger` option is not called. Do not forward the result to an untrusted caller.
- **No body limit applies**, because there is no body.

## Send a Fetch API request

`app.server.handle(request)` takes a Fetch API `Request` and returns a `Response`, or `null` when the path is not an Arc route:

```typescript
const response = await app.server.handle(new Request('http://localhost/api/register-task', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: '1a638f8e-4444-4444-8888-a0b10cdd9977', title: 'Via fetch' })
}));
console.log(response?.status, await response?.json());
```

It runs exactly what a host adapter runs: authentication handlers, tenant resolution, the body limit, the severity cap on `X-Allowed-Severity`, exception redaction, and the `logger`. The request's `signal` becomes `context.signal`. The optional second argument supplies trusted [native context](../hosts/native-principal.md).

## Related

- [Testing](../testing/index.md), which wraps these entry points in scenarios
- [Validation severity filtering](validation-severity-filtering.md)
