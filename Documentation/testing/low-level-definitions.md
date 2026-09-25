---
title: Testing low-level definitions and HTTP
description: Exercise defineCommand and defineQuery definitions, and full HTTP requests, through a real ArcServer with ArcScenario and shouldHaveRuleFailure.
---

`ArcScenario` accepts the same registrations and definitions as `ArcServer`, plus default context fields and per-call overrides, and delegates to a real server. Use it for low-level definitions and for specs that need the full HTTP pipeline.

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

## Entry points

| Method | Runs |
| --- | --- |
| `executeCommand(name, input, context?)` | The direct command pipeline; `context` overrides the scenario's default context fields |
| `validateCommand(name, input, context?)` | Authorization and validation without running the command handler |
| `performQuery(name, input, context?, options?)` | The direct query pipeline, with optional paging and sorting |
| `handle(request)` | The full HTTP pipeline, authenticating with the configured handlers |

For direct calls, supply a trusted principal and tenant through the scenario's context overrides. HTTP `handle` authenticates from its configured handlers instead.

`shouldHaveRuleFailure(result, { reason, member?, severity?, correlationId? })` checks a rule failure, and throws when the only failure is `dependencyUnavailable` or `validatorFailed`.

To check cleanup and handler invocation, record calls in your factory or callback and assert them after the call completes. After your assertions, call `dispose()`; if you passed an existing `ServiceRegistry`, dispose that registry yourself.

## Related

- [Low-level definitions](../commands/low-level-definitions.md)
- [Testing](index.md)
