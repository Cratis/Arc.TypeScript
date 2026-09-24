---
title: Authorization policies and schemes
description: Register named authorization policies as functions or classes, select a named authentication scheme per operation, and compare both with Arc on .NET.
---

Roles answer "is this caller an editor?". Some rules need more: the caller's department, a subscription level, or a service lookup. A named policy puts that rule in one place, and every command or query that needs it names it. A policy checks who may run an operation; it never authenticates the caller.

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

A function policy receives the selected principal and the execution context. Return `true` to allow and `false` to deny.

## Write a policy class

When a policy needs services, pass a class implementing `AuthorizationPolicy` to `addAuthorizationPolicy(name, PolicyClass)`. The builder registers it as scoped, resolves its constructor dependencies from the execution scope, and calls `authorize({ principal, target, resource })`. `target` is the command or query definition; `resource` holds the unvalidated `input` and the `execution` context.

A thrown error fails the operation and is redacted on production HTTP routes. Unknown policies and unknown named schemes throw `InvalidAuthorizationConfiguration` **at build**, and a duplicate policy name is rejected.

For a low-level `defineCommand` or `defineQuery`, write `authorization: { policy: 'Finance', authenticated: true }` and register the policy in the `authorizationPolicies` option.

## How declarations combine

One declaration's roles are alternatives (OR). Stacked `@authorize` or `@roles` decorators are separate requirements that must all pass (AND). A declaration on a `@query()` method replaces the read-model class declaration. `@allowAnonymous()` cannot share a declaration with an authenticated requirement. [Authorizing commands and queries](../authorizing-commands-and-queries.md) covers the decorators and the order of checks.

## Select an authentication scheme

Register named handlers with `authenticationSchemes: { Verified: handler }` and require one with `@authorize({ schemes: ['Verified'] })`. For that operation, Arc tries only the selected handlers in declaration order, strips any scheme the handler set, marks the verified principal with the selected `scheme`, and authorizes against it. The first recognized result wins; several named handlers do not merge identities.

- With `nativePrincipal: true`, the trusted host callback must supply a principal carrying the selected `scheme`. A scheme with no registered handler fails at build.
- Direct calls also need a trusted principal that carries the selected scheme.
- Stacking two declarations that both name schemes is rejected at build: one principal cannot satisfy two independent scheme requirements.
- Observable queries cannot require a scheme, because the multiplexed hub does not authenticate per subscription. Use a policy or roles for them.

Do not confuse a named policy with an authentication scheme: a policy decides, a scheme authenticates.

## Compared with Arc on .NET

Arc on .NET 22.23.0 evaluates named policies through scoped `IAuthorizationPolicy` implementations; an unknown name throws `InvalidAuthorizationConfiguration`. Its policy context holds a principal, a reflected command type or query method (`Target`), and a command or query context (`Resource`). The TypeScript class form receives an operation definition and `{ input, execution }` instead, and a function form is also available. Node schemes select Arc handlers rather than ASP.NET Core authentication and challenge or forbid composition. The paired HTTP conformance fixture is pinned to .NET 22.22.0 and does not verify policy parity with 22.23.0.

## Related

- [Authentication](authentication.md)
- [Authorizing commands and queries](../authorizing-commands-and-queries.md)
- [Capability reference](../reference/capabilities.md#security-identity-tenancy-and-correlation)
