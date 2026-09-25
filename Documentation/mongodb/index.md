---
title: MongoDB
description: Serve model-bound queries from tenant-scoped MongoDB collections with BSON mapping, database-side paging, change-stream observation, and command read models.
---

Your read models live in MongoDB, and every tenant has its own database. Wiring a client, choosing the database per request, mapping concepts and GUIDs to BSON, and turning a change stream into a live query is the same code in every service. `@cratis/arc.mongodb` supplies it: your model declares its fields once, and the collection maps them to BSON and returns instances of your model.

:::note[Source preview]
`@cratis/arc.mongodb` is optional and not published to npm. It uses the MongoDB 6 driver. The [capability reference](../reference/capabilities.md#persistence-and-chronicle) has its status and the checks behind it.
:::

## What it provides

| Capability | Page |
| --- | --- |
| Register collections with `builder.withMongoDB(...)`, or from `Cratis:MongoDB` configuration, and inject them into queries | [Get started](getting-started.md) |
| Choose a database, or a server, per tenant | [Tenancy](tenancy.md) |
| Map decorated fields, concepts, GUIDs, and dates to BSON | [Serializers](serializers.md) |
| Match Arc on .NET's property and collection naming | [Naming policies](naming-policies.md) |
| Count, sort, and page in the database | [Paging](paging.md) |
| Turn a change stream into an observable query | [Observing collections](observing-collections.md) |
| Combine two or three live collections | [Joined observation](joined-observe.md) |
| React to raw collection changes | [Change-stream watcher](change-stream-watcher.md) |
| Store GeoJSON Point, LineString, and Polygon fields | [Geospatial types](geospatial.md) |
| Load a read model by command key | [Command context](../commands/command-context.md#load-a-read-model-by-key) |

`withMongoDB` registers a read-model resolver for the models you list in `readModels`, so a command can declare `@inject(commandReadModel(TaskRecord))` and receive the document whose identity equals the command key. Do not also register another integration, such as Chronicle, as the owner of the same type; `build()` fails when two claim one type.

:::caution[Storage does not authorize a caller]
Arc selects a tenant from the execution context, and the collection selects that tenant's database. Your authentication and authorization still have to verify that the caller may use that tenant and read those documents. Never pass untrusted request JSON directly to a MongoDB filter.
:::

## Low-level helper

The original `MongoReadModels<T, I>` remains for low-level `defineQuery` users. It takes a caller-owned client, `databaseForTenant`, and a trusted `filterFor(input, context)`. Its `queryPage` accepts Arc sorting only for fields listed in `sortableFields`, and caps pages at 100 by default. It has no change streams or field codecs; use the model-bound collection for those.

## Current boundaries

This integration does not supply cross-store transactions or a durable change-stream checkpoint. The watcher shares a stream **within a tenant scope**, not across the process. Recognized transient reads retry at most twice; writes are not retried. Arc-owned clients expose OpenTelemetry MongoDB metrics, but caller-owned clients are not instrumented. Do not infer .NET's process-wide watcher or general-purpose resilience interceptors from these narrower guarantees. The [capability reference](../reference/capabilities.md#persistence-and-chronicle) has the parity details.

Start with [Get started](getting-started.md).
