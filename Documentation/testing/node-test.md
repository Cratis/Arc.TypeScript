---
title: Run a CommandScenario with node:test
description: Test a decorated command with Node.js's built-in test runner and dispose its scenario after the test.
---

You do not need a runner-specific Arc adapter to exercise a command pipeline. `CommandScenario` is runner-neutral: create it once, execute it in a test, and dispose it with `after` when the test finishes. This example needs a built clone with `@cratis/arc.core`, `@cratis/arc.testing`, and `@cratis/fundamentals` available from the workspace.

## Run the scenario

```typescript title="when_archiving.test.ts"
import { test, after } from 'node:test';
import { command } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { CommandScenario } from '@cratis/arc.testing';

const archived: string[] = [];
@command()
class ArchiveTask {
    @field(String) id!: string;
    handle(): void { archived.push(this.id); }
}

const scenario = CommandScenario.for(ArchiveTask);
after(async () => { await scenario.dispose(); });

test('when archiving a task, the command pipeline executes its handler', async () => {
    const result = await scenario.execute({ id: 't-1' });
    result.shouldBeSuccessful();
    if (archived.length !== 1 || archived[0] !== 't-1') throw Error('Task was not archived');
});
```

Compile this TypeScript using the standard decorator configuration described in [Decorators](../decorators.md), then run `node --test when_archiving.test.js`. Inside this clone, `yarn check:node-test` executes the same scenario from [`scripts/check-node-test.test.mjs`](https://github.com/Cratis/Arc.TypeScript/blob/main/scripts/check-node-test.test.mjs), with the decorator calls written explicitly for native Node.js execution. It verifies one passing test and uses `after` to dispose the application. It does not start an HTTP server or check transport behavior; use [HTTP scenarios](low-level-definitions.md) for that boundary.

For runner-neutral scenario assertions and service registration, continue with [Testing commands](commands.md).
