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

The snippet illustrates authorization; it does not configure credential verification. `@authorize('Finance')` is shorthand for the policy without roles; `@authorize()` requires authentication. A policy receives the selected principal and execution context. Return `true` to allow, `false` to deny. A thrown error fails the operation and is redacted on production HTTP routes. Unknown policies and unknown named authentication schemes fail **at build**; duplicate policy registrations are rejected. For a low-level `defineCommand` or `defineQuery`, use `authorization: { policy: 'Finance', authenticated: true }` and configure `authorizationPolicies` in `ArcServerOptions`.

One declaration's roles are **OR**. Multiple stacked `@authorize` or `@roles` decorators are **AND**. A method declaration on a read model replaces the class declaration, as with existing role authorization. `@allowAnonymous` cannot share a declaration with an authenticated requirement. Authorization runs after input transport decoding but before schema validation and handler invocation; an anonymous caller to a protected operation gets 401 with configured authentication, an authenticated denied caller gets 403. Unparseable transport input can still yield 400 for a denied authenticated caller; do not put secrets in parser errors. Per-input `authorize(input, context)` runs after schema validation.

To select a non-default authenticator, register `authenticationSchemes: { Verified: handler }` and use `@authorize({ schemes: ['Verified'] })`. Arc tries only the selected named handlers in declaration order, marks the verified principal with its selected `scheme`, and authorizes against that principal. Do not confuse a named policy with an authentication scheme. For `nativePrincipal: true`, the trusted host callback must supply a principal with the selected `scheme`; a scheme with no registration fails build. Direct calls also need a trusted principal bearing the selected scheme. Multiple named handlers do not merge identities; the first recognized outcome wins.

**.NET comparison:** Arc on .NET has policy and scheme declarations, but the pinned 22.22.0 HTTP fixture does not evaluate named model-bound policies (Arc #2736). TypeScript deliberately evaluates them, like Arc for Kotlin, rather than shipping a declaration that silently grants access. Policy functions here are plain TypeScript callbacks; ASP.NET Core `IAuthorizationPolicy` DI and challenge/forbid scheme handlers do not run in Node. See [identity and authentication](index.md) for verified principal sources and [validation order](../guides/validation-and-authorization.md) for the complete pipeline.
