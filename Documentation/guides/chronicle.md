---
title: Append Chronicle events from commands (experimental)
description: Configure the private Chronicle integration, return events from model-bound commands, and understand its transaction limits.
---

You can return a Chronicle event from an Arc command instead of appending it inside `handle()`. Arc runs authorization and validation first, then the optional `@cratis/arc.chronicle` integration appends the event in the trusted tenant's namespace. The package remains **private and experimental**; it is not published or a substitute for Arc on .NET's transactional Chronicle integration.

The published `@cratis/chronicle` 6.5.0 and `@cratis/fundamentals` 7.19.6 load in native Node ESM with NodeNext resolution. A kernel-backed suite verifies command appends, readback, tenant isolation, before-first concurrency rejection, a projected read-model query, and real Express, Fastify, and Hono HTTP adapters. Run `Source/Chronicle/run-integration.sh` to repeat that check against a task-owned development kernel (Docker required). The test image is `cratis/chronicle:latest-development`, which is mutable; pin a compatible image for reproducible deployment testing.

## Return an event

This is an excerpt from the compiled [kernel suite](../../Source/Chronicle/Integration/LiveArtifacts.ts); initialize `@cratis/chronicle` with `reflect-metadata` before importing decorated artifacts in your application entry point.

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { ArcApplication, command, key } from '@cratis/arc.core';
import '@cratis/arc.chronicle';

@eventType()
class TaskCreated { @field(String) title = ''; }

@command()
class CreateTask {
    @field(String) @key() id = '';
    @field(String) title = '';

    handle(): TaskCreated {
        return Object.assign(new TaskCreated(), { title: this.title });
    }
}

const builder = ArcApplication.createBuilder();
builder.addChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'Tasks' });
builder.add(CreateTask, TaskCreated);
const app = await builder.build();
// Mount app in your HTTP host, then await app.dispose() on shutdown.
```

The connection string above uses the SDK's **development credentials** and accepts the kernel's self-signed certificate. Provide credentials and `skipTlsValidation=false` in production. You can instead pass a caller-owned `client`; Arc never disposes it, so your host must call `client.dispose()`. With a connection string, Arc owns and closes the client. Pass `eventStore` in either case. A caller-owned client must already have a provider that registers the event types, projections, reducers, and reactors you use; an Arc-built client uses a per-builder catalog from `builder.add(...)` and `builder.discover(...)`. Call `addChronicle` before discovering artifacts.

The command's `@key()` field determines its event source ID. `getEventSourceId()` takes precedence over that field; a branded `tuple(id, event)` takes precedence over both and returns `id` to the caller. Without a key, Arc creates a new UUID for each execution. A plain array of registered events appends in one SDK batch; an array of ordinary DTOs remains a response. For a different event target, return an SDK `EventForEventSourceId`, whose route, subject, occurred time, and tags override command defaults. The SDK's `@tag` and `@tags` on event classes still apply. Class decorators `@eventSourceType`, `@eventStreamType`, `@eventStreamId`, and `@eventSubject` set command defaults. Mark a field `@notAudited()` to exclude its value from the permanent causation chain; Arc also excludes SDK `@pii` fields and obvious secret-named fields. The trusted Arc principal, correlation ID, and command causation are scoped with the SDK's async `run` methods.

Use `eventsWithConcurrencyScopes(events, scopes)` for exact, server-authored revisions; scope keys may refer to different sources from the appended events. `EventSequenceNumber.beforeFirst.value` is the initial expected revision. The kernel requires at least one event in a batch: **scope-only empty batches fail**. A routing decorator's `{ concurrency: true }` instead reads the tail immediately before append and scopes that dimension. It does not pin the revision you used when reading state; use exact scopes for a read-modify-write rule.

`ChronicleReadModels` is a tenant-scoped Arc service: inject it with `@inject(ChronicleReadModels)` in commands or `service(ChronicleReadModels)` in queries and call `findInstanceById` or `watch`. A class used by both Arc queries and Chronicle projections needs *both* `@readModel()` decorators (alias one import). The [kernel suite](../../Source/Chronicle/Integration/LiveArtifacts.ts) shows a compiled `byId` query. An absent model should return `null`; the current SDK can still throw when a kernel returns the literal JSON `null`, so do not use this as a nullable, model-bound command parameter yet.

## Failure and consistency boundaries

Chronicle constraint and concurrency rejections become Arc validation results; unknown, incomplete, contradictory, or partial acknowledgments fail the command. Authorization, Arc validation, and a rejecting `provide()` run before the returned events are appended. A single returned batch is sent through one `eventLog.appendMany` call; it is **not** an Arc/Chronicle unit of work. Nested commands, manual appends from `handle()`, command operations, completed aggregates, and other effect scopes do not join that batch and cannot be rolled back with it. No aggregate-root or Arc reactor-command integration is provided; use the Chronicle SDK directly for its own reactors and projections, without claiming .NET reactor command-side-effect semantics.

The older low-level `defineChronicleCommand` remains available. It accepts a client, event store, tenant namespace resolver, and `produce()` returning `{ events, response }`. Its own immediate append semantics and rejection mapping are described in source; use the model-bound path for new Arc commands. Neither route makes the SDK's observer completion synchronous with an append acknowledgment.

See the [capability reference](../reference/capabilities.md) for the distinction between implemented behavior and .NET parity.
