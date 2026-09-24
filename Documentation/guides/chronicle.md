---
title: Append Chronicle events from commands (experimental)
description: Configure the experimental Chronicle integration, return events from model-bound commands, and read projected state.
---

You can return a Chronicle event from an Arc command instead of appending it inside `handle()`. Arc runs authorization and validation first, then the optional `@cratis/arc.chronicle` integration appends the event in the trusted tenant's namespace. The package remains **private and experimental**; it is not published or a substitute for Arc on .NET's transactional Chronicle integration.

The published `@cratis/chronicle` 6.5.0 and `@cratis/fundamentals` 7.19.6 load in native Node ESM with NodeNext resolution. A kernel-backed suite verifies returned-event batches, command-key read models for existing keys, readback, tenant isolation, before-first concurrency rejection, a projected read-model query, and real Express, Fastify, and Hono HTTP adapters. Run `Source/Chronicle/run-integration.sh` to repeat that check against a task-owned development kernel (Docker required). The test image is `cratis/chronicle:latest-development`, which is mutable; pin a compatible image for reproducible deployment testing.

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

## Read projected state in a command

Use `@inject(commandReadModel(LiveView))` on `handle()` or `provide()` to load a registered Chronicle read model by the command's `@key()` field. A missing required model becomes a validation failure; `commandReadModel(LiveView, { optional: true })` passes `null` when the SDK reports absence. Without a usable command key, both forms reject the command. Only Chronicle-decorated models in the application's artifact catalog qualify. If MongoDB owns the model instead, `builder.addMongoDB` provides the same key-based hook for its explicitly configured `readModels`; do not register both integrations as owners of the same type. The [kernel fixture](../../Source/Chronicle/Integration/LiveArtifacts.ts) includes a compiled handler example.

`ChronicleReadModels` is a tenant-scoped service for explicit lookups and queries. Inject it with `@inject(ChronicleReadModels)` or `service(ChronicleReadModels)` and call `findInstanceById` or `watch`. A class used by both Arc queries and Chronicle projections needs *both* `@readModel()` decorators (alias one import). **Published SDK 6.5.0 fails on a literal JSON `null` response from the kernel.** An upstream fix is pending; until it is published, missing read models may surface as an exception rather than a validation result. The live suite covers existing models only. These read-model parameters are not injected into `BaseValidator` rules; make an explicit tenant-scoped lookup in a rule when validation needs state.

You can test returned events without a kernel using `ChronicleCommandScenario.for(CreateTask, TaskCreated)` from `@cratis/arc.chronicle/testing`. Its `execute()` result has `shouldHaveAppendedEvent(TaskCreated, sourceId, event => event.title === '...')`; `givenReadModel(Type, sourceId, instance, tenant?)` pins a model. The in-memory log records successful returned events; it deliberately rejects concurrency scopes and does not run projections, enforce constraints, or replace the kernel suite.

## Failure and consistency boundaries

Chronicle constraint and concurrency rejections become Arc validation results; unknown, incomplete, contradictory, or partial acknowledgments fail the command. Authorization, Arc validation, and a rejecting `provide()` run before returned events are appended. Returned events from nested Arc commands using the same tenant, correlation ID, and event store join the outer command's single `eventLog.appendMany` call. If either command fails, none of their staged events are sent. A nested command's temporary success is not a durable append acknowledgment; only the outer result includes the final commit verdict.

**This is a single-event-log returned-event batch, not a .NET transaction.** An immediate SDK append inside `handle()`, a low-level `defineChronicleCommand`, a command operation, a completed aggregate, or any non-Chronicle effect happens outside this batch and cannot be rolled back. No aggregate-root or Arc reactor-command integration is provided: the SDK constructs reactors independently and its side-effect dispatcher does not execute Arc command returns or guarantee that failed commands fail a reactor partition. Use the SDK directly for its existing event-return reactor behavior; do not claim .NET reactor command-side-effect semantics. The package stays private while missing-model behavior in the published SDK fails the live check.

The older low-level `defineChronicleCommand` remains available. It accepts a client, event store, tenant namespace resolver, and `produce()` returning `{ events, response }`. Its own immediate append semantics and rejection mapping are described in source; use the model-bound path for new Arc commands. Neither route makes the SDK's observer completion synchronous with an append acknowledgment.

See the [capability reference](../reference/capabilities.md) for the distinction between implemented behavior and .NET parity.
