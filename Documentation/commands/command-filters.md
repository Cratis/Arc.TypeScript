---
title: Command filters
description: Authorize or validate all commands with scoped pipeline filters, or validate selected low-level definitions with callbacks.
---

Arc provides two kinds of command filter. Global filters apply to every command, including `@command()` classes and low-level definitions. Per-definition `CommandFilter<T>` callbacks apply only to the `defineCommand` definitions that list them. The two APIs have different result types and ordering semantics; `CommandFilter<T>` remains unchanged.

## Global command filters

Use `AuthorizationCommandFilter` for access decisions and `CommandPipelineFilter` for ordinary result fragments. The global ordinary contract has a different name because `CommandFilter<T>` already names the per-definition validation callback. Register separate groups with `addAuthorizationCommandFilter` and `addCommandPipelineFilter`, or discover decorated classes with `@authorizationCommandFilter()` and `@commandPipelineFilter()`. The builder resolves each service from the command's operation scope; register explicit tokens as scoped or transient services.

```typescript title="command-gates.ts"
import { ArcApplication, authorizationCommandFilter, commandPipelineFilter, commandFilterResult,
    unauthorizedCommandResult, validation, type AuthorizationCommandFilter,
    type CommandPipelineFilter, type CommandContext, type CommandResult } from '@cratis/arc.core';

@authorizationCommandFilter()
export class TenantGate implements AuthorizationCommandFilter {
    onExecution(context: CommandContext): CommandResult | void {
        if (!context.tenantId) return unauthorizedCommandResult(context, 'A tenant is required');
    }
}

@commandPipelineFilter()
class TitleGate implements CommandPipelineFilter {
    onExecution(context: CommandContext): CommandResult | void {
        if (typeof context.command === 'object' && context.command !== null &&
            'title' in context.command && context.command.title === '') {
            return commandFilterResult(context, { validationResults: [validation('A title is required', ['title'])] });
        }
    }
}

export const builder = ArcApplication.createBuilder();
builder.add(TenantGate, TitleGate);
```

A denial answers 403 with `isAuthorized: false` and an optional `authorizationFailureReason`; validation answers 400. Authorization filters always run first regardless of registration order. Within each group registration order is preserved: `ArcOptions` tokens first, explicit `add*` calls next, then decorated classes in `add()` order. Duplicate tokens run only once; a token in both groups fails at build. Each nonempty result fragment merges into the current result; severity is applied to each fragment before deciding whether to stop. Filtered-out warnings cannot bypass later authorization filters. A thrown filter or a fragment with malformed authorization, validation, or exception fields fails the operation with 500; it never permits handling to continue. Omitted fragment fields retain their defaults; supplied authorization must be boolean and validation severity must be a `Severity` value. Both execute and `/validate` run both groups after declared authorization, binding, the bound `authorize` callback, and (for valid input) context-value/key resolution, but before validator or handler dependencies and before scopes, `provide()`, or `handle()`. Context-value providers and key resolvers are trusted preparation and must not perform protected business mutations. Framework-created contexts include a non-writable `operationName` equal to the namespace-qualified declaration identity shown in introspection; manually constructed contexts may omit it. If a filter gates on that name, deny an absent name or explicitly handle the manual case—do not infer it from `context.command`. Malformed input reaches authorization filters without context-value/key resolution. `/validate` runs validators inside an execution runner but never starts execution scopes. If the request is canceled while a filter, context-value provider, key-resolver service resolution, validator dependency or callback, or handler dependency is pending, Arc waits for the pending work to settle, reports cancellation as a failure, and does not start subsequent stages. A callback already running is not interrupted; any started command scopes still complete and operation services are disposed. Cancellation prevents pipeline stages that have not started, but does not replace the result of a completed execution runner: the command returns its actual success or failure, including recovery and operation outcomes. An acknowledged Chronicle append is not failed merely because cancellation stops waiting for observer completion; an actual observer failure still fails the command.

## Per-definition callbacks

Low-level definitions made with `defineCommand` and `defineQuery` do not use validator classes. They take a `validate` callback and a list of `filters`, which run in the same pipeline stage as model-bound validators. List a shared callback on each definition that needs it; these callbacks still aggregate all results without short-circuiting.

## Validate and share a filter

```typescript title="tasks.ts"
import { defineCommand, validation, type CommandFilter } from '@cratis/arc.core';
import { z } from 'zod';

const shortTitle: CommandFilter<{ title: string }> = ({ title }) =>
    title.length <= 200 ? [] : [validation('A title can have at most 200 characters', ['title'])];

export const rename = defineCommand({
    name: 'Rename',
    namespace: 'Tasks',
    schema: z.object({ id: z.string(), title: z.string() }),
    validate: ({ title }) => title.trim() ? [] : [validation('A title is required', ['title'])],
    filters: [shortTitle],
    handle: ({ id, title }) => ({ id, title })
});
```

`validate` runs first, then each filter in order. Every one of them runs, and their results are returned together. A validator or filter may return an array, nothing, or a promise of either. For queries, the filter type is `QueryFilter`.

`validation(message, members?, reason?, severity?)` defaults to no members, the reason `rule`, and `Severity.Error`.

## Keep the schema for shape

A Zod schema failure produces exactly one result with reason `malformedRequest`, no message a user can act on, and no members. That includes Zod refinements such as `z.string().min(3)`. If a client should show "A title is required" next to the title field, return it from `validate` or a filter.

:::caution[Schemas must convert to JSON Schema]
Arc converts every schema to JSON Schema at startup. Types without a JSON representation, such as `z.date()` and `.transform(...)`, make startup throw. Send dates as ISO strings with `z.iso.datetime()` and convert them in the handler.
:::

## When a filter throws

The caller gets 400 with one result: reason `validatorFailed`, message `Validation failed`, and no members. The exception text is never sent; the original error goes to the `logger` option. When the request was already cancelled, the failure is reported as an exception instead.

## Choose the right extension point

Use declared authorization or a named policy for a command-specific access rule, a concept validator for a value used in many commands, and `CommandValidator` for one model-bound command. Use a global authorization filter when a new command must inherit a cross-cutting denial without opting into a policy. Use an ordinary global filter for cross-cutting validation. Command execution runners and scopes wrap execution only; they are not access gates.

## Related

- [Low-level definitions](low-level-definitions.md)
- [Command validation](command-validation.md) for model-bound validators
- [Command pipeline](command-pipeline.md)
