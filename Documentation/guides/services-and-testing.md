---
title: Compose scoped services and test real pipelines
description: Register owned services, declare handler dependencies, and assert command results through the same pipelines used by HTTP.
---

Use a service token when a command or query needs a dependency that must live for one execution or for the server's lifetime. Declare handler dependencies so Arc can reject missing registrations, cycles, and captive lifetimes before calling your handler. The [Tasks sample](../../Samples/Tasks/src/index.ts) uses a singleton in-memory repository for both commands and queries.

## Register a scoped service

This self-contained example creates a distinct journal for every execution. A validation-only call checks that the journal is registered but never constructs it or calls the handler.

```typescript
import { ArcServer, currentServices, defineCommand, serviceToken, Severity } from '@cratis/arc.server';
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

`currentServices()` works only inside an active Arc execution. You can also access the scope through a factory's `resolver` argument; its second argument is the execution context. Do not retain a scope, resolver, or per-request identity in a singleton. Registrations declare `singleton`, `scoped`, or `transient`; a singleton cannot depend on scoped **or transient** services. A factory declares required `dependencies` for preflight and resolves them with `resolver.resolve(token)`. Undeclared dynamic resolution still checks for missing registrations, cycles, and captive lifetimes when called, including `currentServices().resolve(...)` inside a singleton factory, but cannot be preflighted before an effect. Register each token only once. You can supply a `singleton` `instance` instead of a factory; Arc does not dispose that caller-owned instance.

Arc creates and disposes a scope per HTTP or direct call, including a denied or failed execution. A singleton belongs to the registry and is disposed when you call `await server.dispose()` at host shutdown. Scoped and transient instances created by factories belong to the execution scope. Arc calls their `Symbol.asyncDispose` or `Symbol.dispose` once in reverse creation order, including after an exception. A factory alias of an existing singleton or caller-owned instance does not take ownership or dispose it at scope exit. Returning an object owned by another scoped execution fails with a service dependency error instead of transferring ownership. A disposal failure removes a successful response and makes the result fail. Disposal is not a rollback of external effects. If you pass a `ServiceRegistry` to `services`, you own its disposal; a server does not dispose that shared registry. Registry disposal rejects new executions, waits for active pipelines to finish, then disposes their resources. A singleton factory failure poisons the registry; a server pipeline then triggers the same shutdown. A nested command or query retains its causal dependency ancestry for cycle detection (including a singleton requested again through a nested call), but uses its own execution identity and scoped lifetime guard. The same scoped token in two independent nested scopes is not a cycle. A nested pipeline whose singleton factory fails leaves shutdown to a living ancestor; if its parent has already finished and no ancestor remains, the child joins shutdown itself. This avoids waiting on its own caller and still drains unrelated active pipelines. Cleanup failures fail the result of the execution that joins shutdown and are reported as service registry disposal errors. With a manually created scope, call `await scope.dispose()` when finished; a top-level resolution failure also closes that scope and waits for its owned resources to be cleaned up before rejecting. Scope disposal can be joined by later callers, including registry shutdown, and reports the same cleanup failure to each joiner. Call `await registry.dispose()` at host shutdown even when a scope has already begun closing: shutdown waits for in-flight executions and captured scopes to finish, reports their cleanup failures, and only then disposes singletons. A nested pipeline keeps only *live* factory attempts as causal ancestors; a detached callback after its factory settles uses its new scope's identity and lifetime guard, whereas a still-running singleton factory cannot escape the captive check by creating a manual scope. A result prepared before a singleton factory failure is invalidated before publication if the registry is poisoned or closing. Interrupted executions do not report successful responses. Factories and handlers must still observe cancellation themselves.

`validatorDependencies` are preflighted **and constructed** before validators, including on `/validate`; `handlerDependencies` are preflighted but constructed only after validation succeeds on the execution route. Validation-only does not call `provide`, `handle`, or command execution scopes. Authorization runs before dependency checks. A missing dependency is reported with reason `dependencyUnavailable`, not `rule` (HTTP errors are redacted outside development). Existing definitions without service declarations and manually constructed execution contexts still work.

## Test the real pipeline

Use `@cratis/arc.server/testing` for specs that need the same command, query, or HTTP behavior as production. `ArcScenario` accepts the same registrations and definitions as `ArcServer`, optional default context fields, and per-call overrides. It delegates to the real server. After your assertions, call `dispose()`; if you passed an existing registry, dispose that registry yourself.

```typescript
import { ArcScenario, shouldHaveRuleFailure } from '@cratis/arc.server/testing';
import { defineCommand, Severity, validation } from '@cratis/arc.server';
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
