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

## Assertions

The result is the actual `CommandResult` with chainable assertions:

| Assertion | Passes when |
| --- | --- |
| `shouldBeSuccessful()` / `shouldNotBeSuccessful()` | `isSuccess` is true / false |
| `shouldBeValid()` | No blocking validation result |
| `shouldHaveValidationErrors()` | An authored rule failed |
| `shouldHaveValidationErrorFor(message)` | A result has this message |
| `shouldHaveValidationErrorForMember(member)` | A result concerns this member |
| `shouldHaveValidationErrorBecauseOf(reason)` | A result has this reason, such as `validatorFailed` |
| `shouldBeAuthorized()` / `shouldNotBeAuthorized()` | `isAuthorized` is true / false |
| `shouldHaveExceptions()` / `shouldNotHaveExceptions()` | `hasExceptions` is true / false |

A dependency or validator construction failure alone cannot satisfy the generic or member validation assertions: it means no authored rule was established. Unlike .NET, `validatorFailed` alone does not satisfy `shouldHaveValidationErrors()`; assert it explicitly with `shouldHaveValidationErrorBecauseOf('validatorFailed')`.

## Assert operations

| Assertion | Passes when |
| --- | --- |
| `shouldHaveExecutedOperation(Type)` | An operation of that type finished `execute` |
| `shouldHaveCompensatedOperation(Type)` | An operation of that type finished `compensate` |
| `shouldHaveNoOperationInvocations()` | No operation was entered, not even partially |
| `shouldHaveIndeterminateRecovery()` | The recovery status is `Indeterminate` |

These inspect real pipeline observations, not simulated work. See [Command operations](../commands/operations/index.md).

## Related

- [Testing queries](queries.md)
- [Command validation](../commands/command-validation.md)
