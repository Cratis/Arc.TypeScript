---
title: Compose scoped services and test real pipelines
description: Register owned services, declare handler dependencies, and assert command results through the same pipelines used by HTTP.
---

Use a service token when a command or query needs a dependency that must live for one execution or for the server's lifetime. Declare handler dependencies so Arc can reject missing registrations, cycles, and captive lifetimes before calling your handler. The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/main.ts) registers a singleton in-memory service for both its command and queries. Model-bound services also accept class tokens through the [application builder](dependency-injection.md).

## Register a scoped service

This self-contained example creates a distinct journal for every execution. A validation-only call checks that the journal is registered but never constructs it or calls the handler.

```typescript
import { ArcServer, currentServices, defineCommand, serviceToken, Severity } from '@cratis/arc.core';
import { z } from 'zod';

const journal = serviceToken<{ append(text: string): void; entries: string[] }>('journal');
let created = 0;
const server = new ArcServer({
    services: [{ token: journal, lifetime: 'scoped', factory: () => {
        created++;
        const entries: string[] = [];
        return { entries, append: (text: string) => { entries.push(text); } };
    } }],
    commands: [defineCommand({
        name: 'Write',
        schema: z.object({ text: z.string() }),
        handlerDependencies: [journal],
        handle: async ({ text }) => {
            const service = await currentServices().resolve(journal);
            service.append(text);
            return service.entries;
        }
    })]
});
const context = {
    correlationId: crypto.randomUUID(), principal: undefined, tenantId: 'acme',
    signal: new AbortController().signal, allowedSeverity: Severity.Warning
};
const validation = await server.executeCommand('Write', { text: 'hello' }, context, true);
const result = await server.executeCommand('Write', { text: 'hello' }, context);
console.log(validation.isSuccess, result.response, created); // true ['hello'] 1
await server.dispose();
```

`currentServices()` works inside an active Arc execution or factory attempt. You can also access the scope through a factory's `resolver` argument. A scoped or transient factory's second argument is its execution context. A singleton factory instead receives a frozen registry-lifetime context with only `signal`; its resolver and `currentServices()` refer to the registry-owned singleton scope, and `currentContext()` is unavailable during construction. Do not capture a request identity in a singleton through an application closure. Registrations declare `singleton`, `scoped`, or `transient`; a singleton cannot depend on scoped **or transient** services. A factory declares required `dependencies` for preflight and resolves them with `resolver.resolve(token)`. Undeclared dynamic resolution still checks for missing registrations, cycles, and captive lifetimes when called, including `currentServices().resolve(...)` inside a singleton factory, but cannot be preflighted before an effect. Register each token only once. You can supply a `singleton` `instance` instead of a factory; Arc does not dispose that caller-owned instance.

Arc creates and disposes a scope per HTTP or direct call, including a denied or failed execution. A singleton belongs to the registry and is disposed when you call `await server.dispose()` at host shutdown. Scoped and transient instances created by factories belong to the execution scope. Arc calls their `Symbol.asyncDispose` or `Symbol.dispose` once in reverse creation order, including after an exception. A factory alias of an existing singleton or caller-owned instance does not take ownership or dispose it at scope exit. Returning an object owned by another scoped execution fails with a service dependency error instead of transferring ownership. A disposal failure removes a successful response and makes the result fail. Disposal is not a rollback of external effects. If you pass a `ServiceRegistry` to `services`, you own its disposal; a server does not dispose that shared registry. Registry disposal rejects new executions and scopes, including nested work started after shutdown begins. Already admitted executions and scopes can resolve dependencies while they finish; a closing scope only accepts resolutions from its own pending factories. Shutdown drains admitted work and pending singleton construction before aborting the registry-lifetime signal and disposing singleton resources. Singleton factory initialization must finish without waiting for that signal to abort: a factory that never settles can hold shutdown indefinitely. A successful command that finishes during ordinary draining stays successful; shutdown cannot roll back external effects. A singleton factory failure poisons the registry; a server pipeline then triggers the same shutdown. A nested command or query retains its causal dependency ancestry for cycle detection (including a singleton requested again through a nested call), but uses its own execution identity and scoped lifetime guard. The same scoped token in two independent nested scopes is not a cycle. A nested pipeline whose singleton factory fails leaves shutdown to a living ancestor; if its parent has already finished and no ancestor remains, the child joins shutdown itself. This avoids waiting on its own caller and still drains unrelated active pipelines. Cleanup failures fail the result of the execution that joins shutdown and are reported as service registry disposal errors. With a manually created scope, call `await scope.dispose()` when finished; a top-level resolution failure also closes that scope and waits for its owned resources to be cleaned up before rejecting. Scope disposal can be joined by later callers, including registry shutdown, and reports the same cleanup failure to each joiner. Call `await registry.dispose()` at host shutdown even when a scope has already begun closing: shutdown waits for in-flight executions and captured scopes to finish, reports their cleanup failures, and only then disposes singletons. A nested pipeline keeps only *live* factory attempts as causal ancestors; a detached callback after its factory settles uses its new scope's identity and lifetime guard, whereas a still-running singleton factory cannot escape the captive check by creating a manual scope. A result prepared before a singleton factory failure is invalidated before publication if the registry is poisoned. An abandoned caller does not cancel shared construction; the registry retains the original factory task until it settles. A genuine singleton failure poisons the registry and initiates shutdown even when no caller remains. Cancellation is cooperative: factories and handlers must observe request cancellation themselves. Do not await `registry.dispose()` from its own handler, factory, or disposer; it rejects to prevent a shutdown deadlock. Call it from outside owned work and await the same joinable outcome, including cleanup failures. A disposer also cannot await disposal of its own scope (even through nested disposers), but can await an unrelated scope's disposal while the registry is still running. Stop returned singleton background loops when the registry-lifetime signal aborts, then join those loops in the singleton disposer; do not make a loop await shutdown that must join the loop.

`validatorDependencies` are preflighted **and constructed** before validators, including on `/validate`; `handlerDependencies` are preflighted but constructed only after validation succeeds on the execution route. Validation-only does not call `provide`, `handle`, or command execution scopes. Authorization runs before dependency checks. A missing dependency is reported with reason `dependencyUnavailable`, not `rule` (HTTP errors are redacted outside development). Existing definitions without service declarations and manually constructed execution contexts still work.

## Test a decorated command

Use `CommandScenario` when the command's authorization, validator, service resolution, or handler behavior matters to the spec. The [Tasks sample spec](../../Samples/Tasks/Features/Tasks/Registration/for_RegisterTask/when_registering/with_valid_title.ts) runs a decorated command through the real pipeline without starting an HTTP server:

```typescript
const scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);
scenario.services.addSingleton(Tasks, new Tasks());
try {
    const result = await scenario.execute({ id: TaskId.create(), title: new TaskTitle('Plan release') });
    result.shouldBeSuccessful();
} finally {
    await scenario.dispose();
}
```

Import `CommandScenario` from `@cratis/arc.testing` and the domain types from your application. Pass decorated validators as additional arguments: the scenario cannot discover classes that were never imported. Register fakes before `execute()` or `validate()`; the application and its service provider are built lazily on the first call. `execute()` accepts property values or a command instance. `validate()` runs authorization and validation but never calls `provide()` or `handle()`. The scenario returns the actual `CommandResult` with chainable `shouldBeSuccessful()`, `shouldNotBeSuccessful()`, `shouldBeValid()`, `shouldHaveValidationErrors()`, `shouldHaveValidationErrorFor(message)`, `shouldHaveValidationErrorForMember(member)`,  `shouldHaveValidationErrorBecauseOf(reason)`, `shouldBeAuthorized()`, `shouldNotBeAuthorized()`, `shouldHaveExceptions()`, and `shouldNotHaveExceptions()`. A dependency or validator construction failure alone cannot satisfy the generic or member validation assertions; assert its reason explicitly if that failure is the behavior under test. `shouldHaveExecutedOperation(Type)` requires an operation's Execute to finish, `shouldHaveCompensatedOperation(Type)` requires its compensator to finish, `shouldHaveNoOperationInvocations()` rejects even partial invocations, and `shouldHaveIndeterminateRecovery()` checks unknown or mixed commit recovery. These assertions inspect actual pipeline observations, not simulated work. Unlike .NET, `validatorFailed` alone does not satisfy `shouldHaveValidationErrors()` or the member assertion: it means no authored validation rule was established. Use `shouldHaveValidationErrorBecauseOf('validatorFailed')` to assert that failure explicitly.

Inputs are always encoded to Arc's wire representation before the pipeline decodes concepts and model fields. By default, inputs and returned data also pass through JSON stringify/parse. `withSerializationRoundTrip(false)` skips only that JSON step, preserving wire encoding. Set `scenario.withContext({ principal, tenantId, correlationId, signal })` for trusted direct-call identity. Commands also support `withAllowedValidationSeverity(Severity.Error)`; queries always cap allowed severity at Warning. `dispose()` is idempotent. A fake passed to `addSingleton` remains caller-owned, while factories registered through `addScoped` and `addTransient` are application-owned. Use `given(Context, context => { ... })` from `@cratis/arc.testing` to share a context created once per spec suite without a Mocha type dependency.

## Test a query or observable query

`QueryScenario.for(TaskItem, 'taskById')` selects a decorated static `@query` method. Register the same dependencies before calling `perform({ id: TaskId.create() })`; supply `{ paging: { page: 0, pageSize: 10 }, sorting: { field: 'title', direction: 'asc' } }` as a second argument for a list query. Its result is the actual `QueryResult` with JSON-shaped `data`; generic type parameters describe that wire data, not a rehydrated read-model instance. [The Tasks query spec](../../Samples/Tasks/Features/Tasks/Listing/for_TaskItem/when_performing/with_sorting_and_paging.ts) checks sorting and paging through this pipeline.

`ObservableQueryScenario.for(TaskItem, 'observeAllTasks')` opens the real observable pipeline. `collect(count, timeoutMs, arguments, options)` waits for up to `count` emissions, or fails at the explicit deadline, including during opening. A finite stream may complete earlier (`completed: true`); reaching the requested count reports `completed: false`. An opening rejection appears in `rejection` with `completed: false`, not as a successful emission; always assert the expected emission count. The scenario closes its subscription even on a timeout. See [the sample observable spec](../../Samples/Tasks/Features/Tasks/Listing/for_TaskItem/when_collecting/with_current_value.ts).

## Test low-level definitions and HTTP behavior

Use `@cratis/arc.testing` for specs that need the same command, query, or HTTP behavior as production. `ArcScenario` accepts the same registrations and definitions as `ArcServer`, optional default context fields, and per-call overrides. It delegates to the real server. After your assertions, call `dispose()`; if you passed an existing registry, dispose that registry yourself.

```typescript
import { ArcScenario, shouldHaveRuleFailure } from '@cratis/arc.testing';
import { defineCommand, Severity, validation } from '@cratis/arc.core';
import { z } from 'zod';

const scenario = new ArcScenario({ commands: [defineCommand({
    name: 'Create', schema: z.object({ title: z.string() }),
    validate: ({ title }) => title ? [] : [validation('Title required', ['title'], 'rule', Severity.Error)],
    handle: () => ({ created: true })
})] });
try {
    const result = await scenario.executeCommand('Create', { title: '' });
    shouldHaveRuleFailure(result, { reason: 'rule', member: 'title', severity: Severity.Error });
    console.log(result.isSuccess); // false
} finally {
    await scenario.dispose();
}
```

`shouldHaveRuleFailure` checks the reason, optional member/severity/correlation ID, and throws if the only failure is `dependencyUnavailable` or `validatorFailed`. To inspect cleanup and handler invocation, record calls in your factory or callback and assert them after `executeCommand`, `performQuery`, or `handle` completes. For direct calls, supply a trusted principal/tenant through the scenario's context overrides; HTTP `handle` authenticates from its configured handlers instead.
