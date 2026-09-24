---
title: Append Chronicle events from commands (experimental)
description: What the experimental Chronicle integration does, why it cannot run against a real Chronicle today, and exactly how it appends events and reports failures.
---

In Arc on .NET, a command can return events and Arc appends them to [Chronicle](/chronicle/) when the command succeeds. The experimental `@cratis/arc.server.chronicle` package explores the same boundary for Node.js: a command produces events, and the package appends them to the tenant's event store before it reports success.

:::danger[Experimental, private, and not usable against a real Chronicle yet]

- The package is marked `private` and is not published. It is not a supported integration.
- The published Chronicle TypeScript SDK, `@cratis/chronicle` 6.2.0, cannot be imported by Node.js: the import fails with `ERR_UNSUPPORTED_DIR_IMPORT`, on Node.js 24 as well. Version 6.3.1 was inspected and ships the same kind of imports. Without the SDK you cannot create the `IChronicleClient` this package needs.
- The package's specs use typed substitutes for the SDK's public interfaces. They do not load the SDK, and nothing has run against a Chronicle kernel. Passing specs here are not an integration test.

:::

The rest of this page describes the current source, so you can review the design or build on it once the SDK loads.

## Requirements

- Node.js 22.19 or later, which the SDK's HTTP dependency requires.
- `@cratis/chronicle` `^6.2.0` and `@cratis/fundamentals` `^7.19.2` as peer dependencies.
- TypeScript `moduleResolution` set to `Bundler`. The SDK's declaration files use extensionless relative imports. With `NodeNext`, the SDK types do not resolve, and mistakes such as a misspelled event property compile without an error.

## Define a command that produces events

```typescript title="tasks.ts"
import { ArcServer, validation } from '@cratis/arc.server';
import type { AuthenticationHandler } from '@cratis/arc.server';
import { defineChronicleCommand } from '@cratis/arc.server.chronicle';
import type { IChronicleClient } from '@cratis/chronicle';
import { z } from 'zod';

export class TaskCreated {
    constructor(readonly title: string) {}
}

const namespacesByTenant = new Map([['acme', 'acme']]);

export function createTasksServer(client: IChronicleClient, authentication: readonly AuthenticationHandler[]): ArcServer {
    const create = defineChronicleCommand({
        name: 'Create',
        namespace: 'Tasks',
        schema: z.object({ id: z.uuid(), title: z.string() }),
        authorization: { authenticated: true },
        authorize: (_input, context) => namespacesByTenant.has(context.tenantId ?? ''),
        validate: ({ title }) => title.trim() ? [] : [validation('A title is required', ['title'])],
        client,
        eventStore: 'Tasks',
        namespaceForContext: context => namespacesByTenant.get(context.tenantId ?? '') ?? '',
        produce: ({ id, title }) => ({
            events: [{ eventSourceId: id, event: new TaskCreated(title), eventStreamType: 'tasks' }],
            response: { id }
        })
    });
    return new ArcServer({ commands: [create], authentication });
}
```

`defineChronicleCommand` takes every command field except `handle`, plus:

| Field | Purpose |
| --- | --- |
| `client` | An `IChronicleClient` your application creates, connects, and disposes |
| `eventStore` | The event store name |
| `namespaceForContext(context)` | The Chronicle namespace for this request. Arc never derives it from a header on its own. |
| `produce(input, context, provided)` | Returns `{ events, response? }`: the events to append, as the SDK's `EventForEventSourceId`, and the command response |

It returns an ordinary command definition. Authorization, the schema, validators, `provide`, and scopes run as for any command, and `produce` runs in place of `handle`.

The event's class must be registered with the SDK for that event store; the package checks it against the store's `eventTypes.all`, the current-generation constructors exposed by the SDK. Older-generation constructors are not supported by this adapter. Registering event types is done with the Chronicle SDK, not with Arc.

## What happens when the command runs

1. `produce` runs. If the request has been cancelled, the command fails before anything is appended.
2. `namespaceForContext` must return a non-empty namespace, even when there are no events. Otherwise the command fails.
3. An empty `events` list appends nothing, does not contact Chronicle, and returns `response`, which may be an Arc outcome such as `denied(...)`. With events, `response` must not be an Arc outcome.
4. Every event needs an `eventSourceId` and an object. The adapter captures the event list, routing metadata, and response reference before resolving the store. Event payload objects are not deep-cloned: keep them immutable. The package refuses any event whose class is not in the selected store's `eventTypes.all`, before appending anything.
5. One event is appended with `eventLog.append`, passing the Arc correlation ID and the event's source type, stream type, stream ID, subject, occurred time, and tags. Several events are appended with one `eventLog.appendMany` call, with the correlation ID and each event's own metadata.
6. The response is returned only after Chronicle acknowledged every event.

## How append failures are reported

| Chronicle reports | Command result |
| --- | --- |
| Every event accepted | Success with `response` |
| A single event rejected by a constraint | 400 with reason `constraintViolation`, the constraint ID in `reasonDetail` |
| A single event rejected for concurrency | 400 with reason `concurrencyViolation`; `state` has `eventSourceId`, `expectedEventSequenceNumber`, and `actualEventSequenceNumber`. Sequence numbers are strings to preserve 64-bit precision |
| Any error, a thrown call, an unknown result, or a result count that does not match | 500 |
| Some events accepted and others not | 500; accepted events stay appended, because nothing can roll them back |
| A rejected batch of several events | 500. The published SDK returns no results for a rejected batch, so the package cannot tell a constraint violation from any other failure and reports it as an exception. |

Cancellation after Chronicle has acknowledged the append does not undo it. A later execution-scope failure can still fail the overall command despite the committed events; there is no automatic rollback or retry guarantee.

## What it does not do

- No transactions or units of work. Events are not appended atomically with anything else, and a scope cannot roll them back.
- No bridge from Arc's principal or command properties into Chronicle's identity or causation context. The SDK and kernel retain their own auditing and compliance behavior; this adapter adds no Arc-specific compliance or read-model release behavior.
- No waiting for observers, and no reactors, projections, read models, or observable queries.
- No tenant membership check. `namespaceForContext` receives whatever tenant Arc resolved; verify it in `authorize`, as the example does.

## Related

- [Decide command outcomes](command-outcomes.md)
- [Capability reference](../reference/capabilities.md)
- [Chronicle TypeScript client](https://github.com/Cratis/Chronicle.TypeScript)
