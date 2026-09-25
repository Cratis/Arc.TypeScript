---
title: Authorization policies and schemes
description: Register named authorization policies, read claims, make ownership decisions from your own data, understand authorization results, test them with CommandScenario, and select a named authentication scheme per operation.
---

Roles answer "is this caller an editor?". Some rules need more: the caller's department, a subscription level, or whether they own the document they are about to archive. Scattering those checks through handlers makes them easy to forget on the next command. Arc gives each kind of rule one place: a named policy for rules about the caller, and `provide()` for rules about the data. Neither one authenticates the caller; that already happened in an [authentication handler](authentication.md).

## Register and use a policy

```typescript
import { ArcApplication, authorize, command } from '@cratis/arc.core';

@authorize({ policy: 'Finance', roles: ['Reader', 'Admin'] })
@command()
class ReadLedger {
    handle(): string { return 'authorized'; }
}

const builder = ArcApplication.createBuilder({ /* configure verified authentication */ });
builder.add(ReadLedger);
builder.addAuthorizationPolicy('Finance', async (principal) =>
    (principal.claims as Record<string, unknown> | undefined)?.department === 'finance');
const app = await builder.build();
```

The snippet shows authorization only; configure [authentication](authentication.md) for real use. `@authorize('Finance')` is shorthand for the policy without roles, and `@authorize()` alone requires authentication.

A function policy receives the selected principal and the execution context. Return `true` to allow and `false` to deny. Every command and query that names `Finance` now runs the same check, before validation and before your code.

## Write a policy class

When a policy needs services, pass a class implementing `AuthorizationPolicy` to `addAuthorizationPolicy(name, PolicyClass)`. The builder registers it as scoped, resolves its constructor dependencies from the execution scope, and calls `authorize({ principal, target, resource })`. `target` is the command or query definition; `resource` holds the unvalidated `input` and the `execution` context.

A thrown error fails the operation with a 500 and is redacted on production HTTP routes, so a broken policy never lets a caller through. Unknown policies and unknown named schemes throw `InvalidAuthorizationConfiguration` **at build**, and a duplicate policy name is rejected.

For a low-level `defineCommand` or `defineQuery`, write `authorization: { policy: 'Finance', authenticated: true }` and register the policy in the `authorizationPolicies` option.

## How declarations combine

One declaration's roles are alternatives (OR). Stacked `@authorize` or `@roles` decorators are separate requirements that must all pass (AND). A declaration on a `@query()` method replaces the read-model class declaration. `@allowAnonymous()` cannot share a declaration with an authenticated requirement. [Authorizing commands and queries](../authorizing-commands-and-queries.md) covers the decorators and the order of checks.

## Work with claims

Arc's `Principal` has `id`, `roles`, `isAuthenticated`, and optional `name`, `scheme`, and `claims`. `claims` is typed `unknown`, because its shape comes from whoever authenticated the caller:

| Authenticated by | `principal.claims` |
| --- | --- |
| [`jwtBearer()`](authentication.md#verify-jwt-bearer-tokens) | The verified token payload, such as `{ sub, department, roles }` |
| [`microsoftIdentityPlatform()`](authentication.md#accept-easyauth-headers-behind-a-trusted-ingress) | A dictionary from claim type to value, including `sub` and the .NET name and name-identifier claim types |
| A [native principal](../hosts/native-principal.md) or your own handler | Whatever your code put there |

Narrow the value before you use it, as the `Finance` policy above does. Arc freezes the claim dictionary, so no step of the pipeline can change it.

You can read the principal wherever you need it:

- In a policy, from the `principal` argument.
- In a command's `provide()` or `handle()`, by injecting `commandContext()` and reading `context.principal`.
- In any service that runs during a command or query, with `currentContext()?.principal`. It uses Node's `AsyncLocalStorage`, so concurrent requests never see each other's principal, and it returns `undefined` outside an Arc execution.

[Identity details](../identity/index.md) are display data for the frontend. They never add claims to this principal.

## Decide from your own data

"Only the owner may archive a document" is not a rule about the caller alone. You have to load the document first. Do that in `provide()` and return `denied(reason)` when the caller may not continue:

```typescript title="Features/Documents/ArchiveDocument.ts"
import { field } from '@cratis/fundamentals';
import { command, commandContext, denied, inject, rejected, validation, type CommandContext } from '@cratis/arc.core';
import { Documents, type StoredDocument } from './Documents.js';

@command()
export class ArchiveDocument {
    @field(String) id!: string;

    @inject(Documents, commandContext())
    provide(documents: Documents, context: CommandContext) {
        const document = documents.byId(this.id);
        if (!document) return rejected(validation('The document does not exist', ['id'], 'notFound'));
        return document.owner === context.principal?.id ? document : denied('Only the owner can archive a document');
    }

    handle(document: StoredDocument): void {
        document.archived = true;
    }
}
```

`Documents` is your own service. `provide()` runs after authorization and validation, so the caller is already authenticated and the input is well-formed. `denied(...)` stops the command before `handle()` runs and answers 403 with the reason. A missing document is a different outcome: `rejected(...)` answers 400 with a validation result. See [Command outcomes](../commands/command-outcomes.md).

For a low-level definition, the per-request `authorize(input, context)` callback makes the same decision before validation; see [Authorizing commands and queries](../authorizing-commands-and-queries.md#decide-per-request).

:::caution[Keep permission checks out of validators]
A validator result is a validation error, not a denial, and a trusted direct caller can lower the blocking severity. Put ownership and tenant checks in a policy, `provide()`, or `authorize`, where nothing a caller sends changes the outcome.
:::

## Authorization results

When authorization fails, the command or query result has `isAuthorized: false`, and your code never ran:

| Situation | HTTP status | Result |
| --- | --- | --- |
| Anonymous caller on a protected operation, with at least one authentication handler configured | 401 | `isAuthorized: false` |
| The authentication handler returned `Failed` | 401 | `isAuthorized: false` |
| Anonymous caller on a protected operation, with no authentication handler | 403 | `isAuthorized: false` |
| Authenticated caller without a required role, or a policy returned `false` | 403 | `isAuthorized: false` |
| `provide()` or `handle()` returned `denied(reason)` | 403 | `isAuthorized: false`, `authorizationFailureReason: reason` |
| A policy threw | 500 | `hasExceptions: true`, redacted outside development |

Arc on .NET answers 403 for an anonymous caller in the first row; this is a [deliberate difference](../reference/capabilities.md#deliberate-differences). A generated frontend proxy reads the same `isAuthorized` flag from the result, so the UI can tell "not allowed" apart from "invalid input".

## Test authorization

`CommandScenario` runs a command through the real pipeline, including authorization. Set the principal with `withContext` and assert the result:

```typescript title="Features/Documents/for_ArchiveDocument/when_archiving/as_someone_else.ts"
import { CommandScenario, type ScenarioCommandResult } from '@cratis/arc.testing';
import { ArchiveDocument } from '../../ArchiveDocument.js';
import { Documents } from '../../Documents.js';

describe('when archiving a document as someone else', () => {
    const scenario = CommandScenario.for(ArchiveDocument);
    scenario.services.addSingleton(Documents, new Documents());
    scenario.withContext({ principal: { id: 'bob', roles: [], isAuthenticated: true } });
    let result: ScenarioCommandResult;

    beforeAll(async () => { result = await scenario.execute({ id: 'doc-1' }); });
    afterAll(async () => { await scenario.dispose(); });

    it('should not be authorized', () => { result.shouldNotBeAuthorized(); });
    it('should give the reason', () => { result.authorizationFailureReason.should.equal('Only the owner can archive a document'); });
});
```

This assumes a `Documents` service in which `doc-1` belongs to `ada`. Cover at least three principals for each protected command: anonymous, authenticated without the role or ownership, and allowed. The [Library sample](https://github.com/Cratis/Arc.TypeScript/tree/main/Samples/Library/Features/Authors/Registration/for_RegisterAuthor/when_registering) does this for `@roles('Librarian')` with and without the role.

A scenario calls the pipeline directly, so it never runs your authentication handlers. Test those, and any ingress that forwards identity, over HTTP. See [Testing commands](../testing/commands.md) for the full scenario API.

## Select an authentication scheme

Register named handlers with `authenticationSchemes: { Verified: handler }` and require one with `@authorize({ schemes: ['Verified'] })`. For that operation, Arc tries only the selected handlers in declaration order, strips any scheme the handler set, marks the verified principal with the selected `scheme`, and authorizes against it. The first recognized result wins; several named handlers do not merge identities.

- With `nativePrincipal: true`, the trusted host callback must supply a principal carrying the selected `scheme`. A scheme with no registered handler fails at build.
- Direct calls also need a trusted principal that carries the selected scheme.
- Stacking two declarations that both name schemes is rejected at build: one principal cannot satisfy two independent scheme requirements.
- Observable queries cannot require a scheme, because the multiplexed hub does not authenticate per subscription. Use a policy or roles for them.

Do not confuse a named policy with an authentication scheme: a policy decides, a scheme authenticates.

## Compared with Arc on .NET

Arc on .NET 22.23.0 evaluates named policies through scoped `IAuthorizationPolicy` implementations; an unknown name throws `InvalidAuthorizationConfiguration`. Its policy context holds a principal, a reflected command type or query method (`Target`), and a command or query context (`Resource`). The TypeScript class form receives an operation definition and `{ input, execution }` instead, and a function form is also available. Node schemes select Arc handlers, not ASP.NET Core authentication with its challenge and forbid composition.

## Related

- [Authentication](authentication.md)
- [Authorizing commands and queries](../authorizing-commands-and-queries.md)
- [Tenancy](../tenancy/index.md), for tenant membership
- [Capability reference](../reference/capabilities.md#security-identity-tenancy-and-correlation)
