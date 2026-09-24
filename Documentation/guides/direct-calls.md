---
title: Call Arc from code
description: Run the HTTP pipeline with a Fetch API Request, or run a command or query directly with an execution context you supply, and know what each path skips.
---

Sometimes a command or query has to run without a web framework: in an in-process spec, a background job, a message consumer, or a host that already speaks the Fetch API. `ArcServer` has three entry points for that. They differ in how much of the HTTP pipeline they run and in how much they trust the caller.

| Entry point | Runs | Trusts the caller with |
| --- | --- | --- |
| `handle(request)` | The full HTTP pipeline | Nothing beyond an HTTP client |
| `executeCommand(name, input, context, validateOnly?)` | Authorization, schema, validators, and the command | The whole execution context, including allowed severity |
| `performQuery(name, input, context, options?)` | Authorization, schema, validators, and the query | The whole execution context, except allowed severity |

The examples use the `arc` module from [Host Arc in Express, Fastify, or Hono](host-integration.md#define-the-server-once).

## Send a Fetch API request

`arc.handle(request)` takes a Fetch API `Request` and returns a `Response`, or `null` when the path is not an Arc route:

```typescript
import { arc } from './arc.js';

const response = await arc.handle(new Request('http://localhost/api/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'hello' })
}));
console.log(response?.status, await response?.json());
```

It runs exactly what an adapter runs: authentication handlers, tenant resolution, the body limit, the severity cap on `X-Allowed-Severity`, exception redaction, and the `logger` option. The request's `signal` becomes `context.signal`.

## Run a command directly

```typescript
import { randomUUID } from 'node:crypto';
import { Severity } from '@cratis/arc.core';
import { arc } from './arc.js';

const result = await arc.executeCommand('Echo', { value: 'hello' }, {
    correlationId: randomUUID(),
    principal: { id: 'import-job', roles: ['system'], isAuthenticated: true },
    tenantId: 'acme',
    signal: AbortSignal.timeout(5_000),
    allowedSeverity: Severity.Warning
});
console.log(result.isSuccess, result.response);
```

`executeCommand` and `performQuery` find the operation by its full name: the namespace and name joined with a dot, such as `Tasks.Create`, or the bare name when the definition has no namespace. They throw when no operation matches. Pass `true` as the fourth argument of `executeCommand` to validate without running the command, like the `/validate` route. `performQuery` takes paging and sorting as its fourth argument, for example `{ paging: { page: 0, pageSize: 10 } }`.

## What a direct call does differently

- **You supply the context.** No authentication handler runs and no tenant is resolved. `authorization` and `authorize` still run against the principal and tenant you pass, so pass the real ones.
- **Allowed severity is yours to choose for commands.** `executeCommand` uses `context.allowedSeverity` as given, including `Severity.Error`, which lets error-severity validation results pass. HTTP callers cannot do that. Only pass it from code that is entitled to override business rules. `performQuery` always uses `Severity.Warning`.
- **The context is ambient.** Arc freezes a copy of your context and makes it available through `currentContext()` for the duration of the call. A nested call gets its own context, and the outer one is restored when it returns.
- **Nothing is redacted or logged.** Exception messages and stack traces stay in the result, and the `logger` option is not called. Do not forward the result to an untrusted caller.
- **No body limit applies**, because there is no body.

## Related

- [Host Arc in Express, Fastify, or Hono](host-integration.md)
- [Validate and authorize commands and queries](validation-and-authorization.md)
- [Configure the server](configuration.md)
