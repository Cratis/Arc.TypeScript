---
title: Testing Chronicle commands
description: Assert the events a command returns with ChronicleCommandScenario, pin command read models, and know what the in-memory event log does not enforce.
---

A command that returns Chronicle events should be testable without starting a kernel. `ChronicleCommandScenario` from `@cratis/arc.chronicle/testing` runs the command through the real Arc pipeline and records the appended events in an in-memory event log.

:::caution[Experimental]
The Chronicle integration is experimental. See [Chronicle](../chronicle/index.md) for its status.
:::

## Assert an appended event

This excerpt is from the package's own [scenario spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/testing/for_ChronicleCommandScenario/when_executing/with_returned_events.ts), with imports rewritten to the packages:

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';
import { eventSourceType } from '@cratis/arc.chronicle';
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';

@eventType() class Registered {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}

@command() @eventSourceType('Task', { concurrency: true }) class Register {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): Registered { return new Registered(this.name); }
}

const scenario = ChronicleCommandScenario.for(Register, Registered);
try {
    const result = await scenario.execute({ id: 'source-1', name: 'Ada' });
    result.shouldBeSuccessful();
    result.shouldHaveAppendedEvent(Registered, 'source-1', event => event.name === 'Ada');
} finally {
    await scenario.dispose();
}
```

Pass every event type the command returns to `for(...)`; the in-memory log refuses unregistered events.

## What the scenario offers

| Member | Meaning |
| --- | --- |
| `execute(values)` | Run the command; the result has the usual [command assertions](commands.md#assertions) |
| `result.shouldHaveAppendedEvent(Type, sourceId?, predicate?)` | An event of that type was appended in **this** execution, optionally to a source and matching a predicate |
| `result.appendedEvents` | This execution's events, with routing, subject, and tags |
| `scenario.appendedEvents` | Every event appended so far |
| `givenReadModel(Type, sourceId, instance, tenant?)` | Pin a read model returned for `commandReadModel(Type)`; the tenant defaults to `Default` |

## What it does not do

The in-memory log records successful returned events and their routing and accepts concurrency scopes, but it does not enforce concurrency or constraints, run projections, or replace the kernel suite. Use `Source/Chronicle/run-integration.sh` for behavior against a real kernel.

## Related

- [Chronicle commands](../chronicle/commands/index.md)
- [Testing commands](commands.md)
