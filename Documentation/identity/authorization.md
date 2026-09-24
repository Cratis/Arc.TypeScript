---
title: Authorize commands and queries
description: Register named policies, choose a verified principal, and understand authorization order and status codes.
---

A policy checks who may run an operation; it does not authenticate the caller. Register a policy before building the application, then declare it on the command, read model, or query method that needs protection.

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

The snippet illustrates authorization; it does not configure credential verification. `@authorize('Finance')` is shorthand for the policy without roles; `@authorize()` requires authentication. A function policy receives the selected principal and execution context. You can also pass a class implementing `AuthorizationPolicy` to `addAuthorizationPolicy(name, PolicyClass)`: the builder registers it as scoped, resolves constructor dependencies from the execution scope, and calls `authorize({ principal, target, resource })`. `target` is the command/query definition and `resource` contains the unvalidated `input` and `execution` context. Return `true` to allow, `false` to deny. A thrown error fails the operation and is redacted on production HTTP routes. Unknown policies and unknown named authentication schemes throw `InvalidAuthorizationConfiguration` **at build**; duplicate policy registrations are rejected. For a low-level `defineCommand` or `defineQuery`, use `authorization: { policy: 'Finance', authenticated: true }` and configure `authorizationPolicies` in `ArcServerOptions`.

One declaration's roles are **OR**. Multiple stacked `@authorize` or `@roles` decorators are **AND**. A method declaration on a read model replaces the class declaration, as with existing role authorization. `@allowAnonymous` cannot share a declaration with an authenticated requirement. Authorization runs after input transport decoding but before schema validation and handler invocation; an anonymous caller to a protected operation gets 401 with configured authentication, an authenticated denied caller gets 403. Unparseable transport input can still yield 400 for a denied authenticated caller; do not put secrets in parser errors. Per-input `authorize(input, context)` runs after schema validation.

To select a non-default authenticator, register `authenticationSchemes: { Verified: handler }` and use `@authorize({ schemes: ['Verified'] })`. Arc tries only the selected named handlers in declaration order, strips any scheme supplied by the handler, marks the verified principal with the selected `scheme`, and authorizes against that principal. Do not confuse a named policy with an authentication scheme. For `nativePrincipal: true`, the trusted host callback must supply a principal with the selected `scheme`; a scheme with no callable registration fails build. Direct calls also need a trusted principal bearing the selected scheme. Multiple named handlers do not merge identities; the first recognized outcome wins. Multiple stacked declarations with schemes are rejected at build because a principal cannot satisfy two independent scheme requirements. Scheme-protected observable queries are rejected at build: the multiplexed hub does not authenticate per subscription. Use a policy or roles for observable queries instead.

**.NET comparison:** Arc on .NET 22.23.0 evaluates named policies using scoped `IAuthorizationPolicy` implementations; an unknown name throws `InvalidAuthorizationConfiguration`. Its policy context holds a principal, a reflected command type or query method (`Target`), and a command/query context (`Resource`). The TypeScript class form uses an operation definition and `{ input, execution }` instead of .NET reflection and context objects; the function form remains available. Node schemes select Arc handlers rather than ASP.NET Core authentication and challenge/forbid composition. The paired HTTP conformance fixture remains pinned to .NET 22.22.0 and does not verify policy parity with 22.23.0. See [identity and authentication](index.md) for verified principal sources and [validation order](../guides/validation-and-authorization.md) for the complete pipeline.
