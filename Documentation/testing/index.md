---
title: Testing
description: Test commands, queries, and observable queries through Arc's real pipelines without starting a server, and choose the boundary that can catch the bug you care about.
---

A spec that calls `handle()` directly skips everything Arc does around it: binding, authorization, validators, services, and the result envelope. A spec that starts an HTTP server is slow and fragile. `@cratis/arc.testing` runs your artifacts through the **real** pipelines in-process, so a passing spec means the behavior a client sees, without a listener or a port.

A useful spec still answers one precise question. Is the decision right? Did Arc enforce the rule? Did the operation get undone? Each question has a boundary that answers it cheaply.

## Choose the boundary that can catch the bug

| What you need to prove | Start with | It does not prove |
| --- | --- | --- |
| A calculation or decision | A direct `handle()` spec with explicit inputs | Validation, authorization, `provide()`, or services |
| Validation, authorization, `provide()`, services, and the response | `CommandScenario` | HTTP routing, authentication handlers, or real infrastructure |
| Operations executing and compensating in order | `CommandScenario` with fake providers | That a real provider undid anything |
| A query's arguments, paging, sorting, and result shape | `QueryScenario` | The database's own query behavior |
| A live query's emissions | `ObservableQueryScenario` | A transport or a browser client |
| The route, the host, and authentication | `ArcScenario` with HTTP requests | Business edge cases you did not send |
| Events a command appends for Chronicle, from pinned read models | `ChronicleCommandScenario` | Stored history, aggregates, projections, or constraints |
| A command that depends on stored events or an aggregate | `ChronicleKernelScenario` against a running kernel | Replays or concurrent writers after the check |

Combine boundaries rather than pushing every case through the widest one. Cover decision branches with fast direct specs, add scenario specs for the Arc contracts that matter, and keep a smaller set of HTTP or integration tests for real composition.

## Learn by doing

Two lessons build the habit step by step, each with runnable specs:

- [Test a command's decision and its pipeline](command-decisions.md) tests one shipping-quote command both ways: directly for the arithmetic, through `CommandScenario` for validation and the service call.
- [Test operations and compensation](command-operations.md) proves that Arc runs a command's operations, stops after a provider failure, and compensates in reverse order.

## Pick a scenario

| Scenario | Use it for | Page |
| --- | --- | --- |
| `CommandScenario` | A decorated command, its validators, services, authorization, and operations | [Commands](commands.md) |
| `QueryScenario` | A decorated static query, with arguments, paging, and sorting | [Queries](queries.md) |
| `ObservableQueryScenario` | A decorated observable query, collecting emissions with a deadline | [Observable queries](observable-queries.md) |
| `ArcScenario` | Low-level definitions and full HTTP requests | [Low-level definitions](low-level-definitions.md) |
| `ChronicleCommandScenario` | Commands that return Chronicle events, without a kernel | [Chronicle](chronicle.md) |
| `ChronicleKernelScenario` | Chronicle commands with seeded events, aggregates, projections, and constraints | [Chronicle kernel scenarios](chronicle-kernel.md) |

Every scenario builds its application lazily on the first call, lets you register fakes first, and must be disposed with `await scenario.dispose()`; disposal is idempotent. For the built-in Node.js runner, [run a CommandScenario with node:test](node-test.md) using `after` for disposal.

## Share a context with given()

The Tasks sample's specs use `given(Context, context => { ... })` from `@cratis/arc.testing` to create one context per spec suite, without depending on Mocha types:

```typescript title="Features/Tasks/Registration/for_RegisterTask/given/a_task_registration.ts"
import { CommandScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { RegisterTask, RegisterTaskValidator } from '../../Registration.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(Tasks, this.tasks);
    }
}
```

`extend(...)` installs anything the application's builder needs before the scenario builds it; here, the generated metadata that binds `handle(tasks: Tasks)` without `@inject`. Because `given(...)` creates **one** context for the whole `describe`, run the action in `beforeAll` and dispose in `afterAll`. A scenario disposed after the first test cannot run again.

The `for_<Subject>/when_<action>/<case>.ts` layout follows the Cratis specification conventions; each spec file reads as a sentence. Run the sample's specs with `yarn vitest run Samples/Tasks`.

## Wire round trips

Scenario inputs are always encoded to Arc's wire representation before the pipeline decodes them, exactly as over HTTP. By default inputs and returned data also pass through JSON `stringify` and `parse`, so a concept in a response arrives as its primitive value. `withSerializationRoundTrip(false)` skips only that JSON step and keeps wire encoding.

## Next step

Start with [Test a command's decision and its pipeline](command-decisions.md), or go straight to [Testing commands](commands.md) for every assertion.

## Related

- [Calling commands from code](../commands/calling-commands-from-code.md), the entry points scenarios build on
- [Dependency injection](../dependency-injection.md)
