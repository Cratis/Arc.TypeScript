---
title: Testing
description: Test commands, queries, and observable queries through Arc's real pipelines without starting a server, with scenarios from @cratis/arc.testing.
---

A spec that calls `handle()` directly skips everything Arc does around it: binding, authorization, validators, services, and the result envelope. A spec that starts an HTTP server is slow and fragile. `@cratis/arc.testing` runs your artifacts through the **real** pipelines in-process, so a passing spec means the behavior a client sees.

## Pick a scenario

| Scenario | Use it for | Page |
| --- | --- | --- |
| `CommandScenario` | A decorated command, its validators, services, and operations | [Commands](commands.md) |
| `QueryScenario` | A decorated static query, with arguments, paging, and sorting | [Queries](queries.md) |
| `ObservableQueryScenario` | A decorated observable query, collecting emissions with a deadline | [Observable queries](observable-queries.md) |
| `ArcScenario` | Low-level definitions and full HTTP requests | [Low-level definitions](low-level-definitions.md) |
| `ChronicleCommandScenario` | Commands that return Chronicle events, without a kernel | [Chronicle](chronicle.md) |

Every scenario builds its application lazily on the first call, lets you register fakes first, and must be disposed with `await scenario.dispose()`; disposal is idempotent.

## Share a context with given()

The Tasks sample's specs use `given(Context, context => { ... })` from `@cratis/arc.testing` to create one context per spec suite, without depending on Mocha types:

```typescript title="for_RegisterTask/given/a_task_registration.ts"
import { CommandScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { RegisterTask } from '../../RegisterTask.js';
import { RegisterTaskValidator } from '../../RegisterTaskValidator.js';

export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);

    constructor() { this.scenario.services.addSingleton(Tasks, this.tasks); }
}
```

The `for_<Subject>/when_<action>/<case>.ts` layout follows the Cratis specification conventions; each spec file reads as a sentence. Run the sample's specs with `yarn vitest run Samples/Tasks`.

## Wire round trips

Scenario inputs are always encoded to Arc's wire representation before the pipeline decodes them, exactly as over HTTP. By default inputs and returned data also pass through JSON `stringify` and `parse`. `withSerializationRoundTrip(false)` skips only that JSON step and keeps wire encoding.

## Related

- [Calling commands from code](../commands/calling-commands-from-code.md), the entry points scenarios build on
- [Dependency injection](../dependency-injection.md)
