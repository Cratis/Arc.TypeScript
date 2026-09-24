---
title: Chronicle
description: Return Chronicle events from Arc commands and read projected state, with the experimental @cratis/arc.chronicle integration, and know what it guarantees and what it does not.
---

Arc does not require event sourcing: a command can do its work through any service. When you want commands to record facts in [Chronicle](/chronicle/), the event-sourcing database, `@cratis/arc.chronicle` lets a command **return** events instead of appending them inside `handle()`. Arc runs authorization and validation first, then appends the returned events in the trusted tenant's namespace.

:::caution[Experimental]
`@cratis/arc.chronicle` is experimental and, like every package here, not published to npm. It is not a substitute for Arc on .NET's transactional Chronicle integration: it provides a single-event-log batch of returned events, with no aggregate or reactor-command parity. Its APIs can change.
:::

## What is verified

The integration uses the published Chronicle TypeScript SDK, `@cratis/chronicle` 6.5.1, with `@cratis/fundamentals` 7.19.6; both load in native Node ESM with NodeNext resolution. An opt-in suite runs against a real development kernel and checks:

- returned-event batches, readback, and tenant isolation;
- before-first concurrency rejection;
- command-key read models for existing and missing keys;
- a projected read-model query;
- all of it through real Express, Fastify, and Hono HTTP adapters.

Run `bash Source/Chronicle/run-integration.sh` to repeat it; Docker is required. The test image `cratis/chronicle:latest-development` is mutable, so pin a compatible image for reproducible deployment testing. The ordinary `yarn test` specs use typed substitutes and never start a kernel.

## Find your way

| Page | Use it when you want to |
| --- | --- |
| [Add event sourcing](add-event-sourcing.md) | Register Chronicle with the application builder |
| [Returning events](commands/index.md) | Return one event, a batch, or events next to a response |
| [Resolving the event source ID](resolving-event-source-id.md) | Choose which event source an event is appended to, and route it |
| [Concurrency](commands/concurrency.md) | Reject an append when the stream moved |
| [Causation and auditing](commands/causation.md) | Keep secrets out of the permanent causation chain |
| [Transactional commands](commands/transactional-commands.md) | Understand the batch across nested commands and its failure rules |
| [Read models](read-models/index.md) | Load projected state into commands and queries |
| [Testing Chronicle commands](../testing/chronicle.md) | Assert returned events without a kernel |

## Related

- [Chronicle TypeScript client](https://github.com/Cratis/Chronicle.TypeScript), where the SDK is developed
- [CQRS without event sourcing](/arc/arc-without-event-sourcing/)
- [Capability reference](../reference/capabilities.md#persistence-and-chronicle)
