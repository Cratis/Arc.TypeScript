---
title: Testing commands
description: Run a decorated command through the real pipeline with CommandScenario, register fakes, set a trusted context, and assert results, validation, and operations.
---

Use `CommandScenario` when the command's authorization, validators, service resolution, or handler behavior matters to the spec. It runs the command through the same pipeline as HTTP, without starting a server.

## Execute a command

The [Tasks sample spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/for_RegisterTask/when_registering/with_valid_title.ts) registers a task and checks both the result and the service:

```typescript
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_registration } from '../given/a_task_registration.js';

describe('when registering a task with a valid title', given(a_task_registration, context => {
    const id = TaskId.create();
    let result: ScenarioCommandResult;

    beforeAll(async () => {
        result = await context.scenario.execute({ id, title: new TaskTitle('Plan release') });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed through the command pipeline', () => { result.shouldBeSuccessful(); });
    it('should register the task with the service', () => {
        String(context.tasks.byId(id)?.title.value).should.equal('Plan release');
    });
}));
```

The context class `a_task_registration` is shown in [Testing](index.md#share-a-context-with-given).

- `CommandScenario.for(Command, ...artifacts)` takes the command and any decorated validators or other artifacts it needs. It cannot discover classes that were never imported.
- `execute(values)` accepts property values or a command instance. `validate(values)` runs authorization and validation but never calls `provide()` or `handle()`.
- Register fakes on `scenario.services` before the first call: `addSingleton(Token, instance)` keeps a caller-owned instance; `addScoped(Token, factory)` and `addTransient(Token, factory)` register application-owned factories.

## Set a trusted context

`scenario.withContext({ principal, tenantId, correlationId, signal })` sets the identity a trusted direct caller would pass. `withAllowedValidationSeverity(Severity.Error)` lets error-severity results pass, which only trusted callers can do; see [Validation severity filtering](../commands/validation-severity-filtering.md).

## Test authorization

A decorator moved to the wrong class, or a new command without one, leaves an operation open, and no other spec notices. Specify who may call as deliberately as what the command does. This command requires the `Planner` role:

```typescript title="ArchiveTask.ts"
import { field } from '@cratis/fundamentals';
import { command, roles } from '@cratis/arc.core';

export const archived: string[] = [];

@command()
@roles('Planner')
export class ArchiveTask {
    @field(String) id!: string;

    handle(): void {
        archived.push(this.id);
    }
}
```

Cover the three callers that matter: nobody, somebody without the role, and somebody with it:

```typescript title="for_ArchiveTask/when_archiving.ts"
import { CommandScenario } from '@cratis/arc.testing';
import { ArchiveTask } from '../ArchiveTask.js';

const planner = { id: 'ada', roles: ['Planner'], isAuthenticated: true };
const viewer = { id: 'grace', roles: ['Viewer'], isAuthenticated: true };

describe('when archiving a task', () => {
    let scenario: CommandScenario<ArchiveTask>;
    beforeEach(() => { scenario = CommandScenario.for(ArchiveTask); });
    afterEach(async () => { await scenario.dispose(); });

    it('should deny an anonymous caller', async () => {
        (await scenario.execute({ id: 't-1' })).shouldNotBeAuthorized();
    });
    it('should deny a caller without the role', async () => {
        (await scenario.withContext({ principal: viewer }).execute({ id: 't-1' })).shouldNotBeAuthorized();
    });
    it('should allow a planner', async () => {
        (await scenario.withContext({ principal: planner }).execute({ id: 't-1' })).shouldBeSuccessful();
    });
    it('should deny on the validation route too', async () => {
        (await scenario.withContext({ principal: viewer }).validate({ id: 't-1' })).shouldNotBeAuthorized();
    });
});
```

The principal you pass is what an authentication handler would have produced: an `id`, `roles`, and `isAuthenticated`. The scenario runs Arc's real authorization stage, so the specs fail if the decorator disappears. They do not exercise your authentication handler or the HTTP status code; test those through [`ArcScenario`](low-level-definitions.md) requests.

A decision that needs loaded data, such as "only the owner may rename", returns `denied(reason)` from `provide()`. The same assertion covers it, and the reason is on the result: `result.shouldNotBeAuthorized()` and `result.authorizationFailureReason.should.equal('Only the owner can rename a task')`. For queries, `QueryScenario` and `ObservableQueryScenario` take the same `withContext({ principal })`, and a denied query reports `isAuthorized: false`, on the result for `QueryScenario` and on `rejection` for `ObservableQueryScenario`.

## Assertions

The result is the actual `CommandResult` with chainable assertions:

| Assertion | Passes when |
| --- | --- |
| `shouldBeSuccessful()` / `shouldNotBeSuccessful()` | `isSuccess` is true / false |
| `shouldBeValid()` | No blocking validation result |
| `shouldHaveValidationErrors()` | An authored rule failed |
| `shouldHaveValidationErrorFor(text)` | A result's message **contains** this text (case-sensitive) |
| `shouldHaveValidationErrorForMember(member)` | A result concerns this member |
| `shouldHaveValidationErrorBecauseOf(reason)` | A result has this reason, such as `validatorFailed` |
| `shouldBeAuthorized()` / `shouldNotBeAuthorized()` | `isAuthorized` is true / false |
| `shouldHaveExceptions()` / `shouldNotHaveExceptions()` | `hasExceptions` is true / false |

Assert the field with `shouldHaveValidationErrorForMember('title')`, not `shouldHaveValidationErrorFor('title')`: the second passes for any message that happens to contain the word. Pass the full message to `shouldHaveValidationErrorFor` when the wording matters.

A dependency or validator construction failure alone cannot satisfy the generic or member validation assertions: it means no authored rule was established. Unlike .NET, `validatorFailed` alone does not satisfy `shouldHaveValidationErrors()`; assert it explicitly with `shouldHaveValidationErrorBecauseOf('validatorFailed')`.

## Assert operations

| Assertion | Passes when |
| --- | --- |
| `shouldHaveExecutedOperation(Type)` | An operation of that type finished `execute` |
| `shouldHaveCompensatedOperation(Type)` | An operation of that type finished `compensate` |
| `shouldHaveNoOperationInvocations()` | No operation was entered, not even partially |
| `shouldHaveIndeterminateRecovery()` | The recovery status is `Indeterminate` |

These inspect real pipeline observations, not simulated work. [Test operations and compensation](command-operations.md) walks through a full example, including a failure in the middle of a batch. See also [Command operations](../commands/operations/index.md).

## Related

- [Testing queries](queries.md)
- [Command validation](../commands/command-validation.md)
