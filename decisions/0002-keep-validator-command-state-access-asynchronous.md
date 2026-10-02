---
id: 0002-keep-validator-command-state-access-asynchronous
title: Keep readModelForValidation as the validator command-state API
status: accepted
stage: none
class: contract
reversibility: costly
decided: 2026-10-02
decider: Sindre Alstad Wilting
applies-to:
  - Source/Core/validation/**
  - Source/Core/commands/modelBound/**
  - Source/Core/build/**
  - Documentation/core/**
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

> **2026-10-02 — clarification.** Sindre Alstad Wilting made and owns this decision; the decider attribution is corrected. The choice is unchanged.

## Context

[#51](https://github.com/Cratis/Arc.TypeScript/issues/51) asks whether validators should receive loaded command read models through constructor injection, as in .NET. A command read model is a provider-owned instance resolved by the executing command's resolved key in its execution scope, not a separate model category or a general query result.

In .NET v22.45.0, graph validation uses the command's service provider. Unless a validator is explicitly registered, discovery selects its public constructor with the most parameters and resolves those parameters through DI. Scoped factories for owned read-model types use `CommandContext` and synchronously wait for the provider's asynchronous resolver with `.GetAwaiter().GetResult()`. Validation, `Provide()` and `Handle()` share the scoped instance. Nullable dependencies can receive `null`; missing required registered models with a usable key become `ReadModelDoesNotExistForCommand`. Protected-decision mode can reject dependency-taking validators. Generator-time constructor execution is not runtime DI.

TypeScript v0.57.0 instead establishes an `AsyncLocalStorage` validation context. `readModelForValidation()` uses the same resolver and per-command cache as `commandReadModel()` arguments, with the resolved command key and trusted tenant context. Required absence becomes `validatorFailed`; optional absence returns `null`. Calling the helper outside command validation throws. Ordinary service constructor injection already exists, but build preflight constructs validators without a command or tenant. Loading command state during that construction cannot work.

## Decision

`readModelForValidation()` stays the supported asynchronous API for validator access to command-keyed read models. Validators do not receive loaded command read-model instances through constructor injection now. Ordinary service injection remains supported when construction is safe during preflight; cross-entity searches use application-owned repositories rather than treating command-key lookup as a general query API. The existing helper is neither removed nor deprecated, and its behavior is unchanged.

## Options considered

- **Keep the asynchronous rule helper (chosen).** Already shipped, provider-neutral and cached; avoids startup state reads. It retains ambient context and requires pipeline-based testing.
- **Await command read models before constructing validators.** Deferred: technically possible without synchronous blocking, but requires command-aware activation, revised preflight, nullable-binding rules and careful lifetime handling. No demonstrated consumer needs it now.
- **Constructor-inject a lazy reader instead of a loaded instance.** Deferred: avoids startup reads but adds another abstraction while still requiring asynchronous rule access, with insufficient benefit over the helper.

## Default if unanswered

The helper remains available, but constructor-shape parity stays ambiguous. Consumers may assume .NET-style loaded dependencies work during preflight, and reviews repeatedly reopen validator activation without a concrete usability requirement.

## Timeline and scope

This choice applies now and until superseded. Reopen it when a real application demonstrates material duplication or usability problems with the helper. Any replacement must explain command-aware activation, preflight, nullable dependencies, caching, tenant isolation and lifetimes. Templates#61 supplies no constructor-state requirement. General changes to validator lifecycle and tenant-dependent service construction are out of scope.

[#168](https://github.com/Cratis/Arc.TypeScript/issues/168) owns the provider-neutral specifications and documentation for this boundary.

## Verification

- **Done when:** specifications cover execution, `/validate`, optional and required absence, invalid outside-validation access, shared validation/preparation/handler state, concurrent command and tenant isolation, and preflight without command-state reads; documentation distinguishes the supported helper from ordinary service injection and .NET's constructor shape.
- **Verify by:** run provider-neutral command-validation specifications under #168, including cache sharing, isolation, cancellation and failure behavior; check the API documentation against those cases and confirm preflight performs no command-state loading.

## Consequences

Existing applications keep their API and behavior. Validation can await provider I/O without imposing .NET's synchronous DI bridge on TypeScript. Authors must access command state inside asynchronous rules and test those rules through the command pipeline. Constructor ergonomics remain unavailable until demonstrated need justifies the activation and lifecycle changes.

## Evidence

Paths below refer to the inspected tags, not moving branch heads.

- Arc.TypeScript **v0.57.0**: [`Source/Core/validation/readModelForValidation.ts`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Source/Core/validation/readModelForValidation.ts) — supported helper and validation context.
- Arc.TypeScript **v0.57.0**: [`Source/Core/commands/modelBound/commandContextArgument.ts`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Source/Core/commands/modelBound/commandContextArgument.ts) — command-key resolution and shared cache.
- Arc.TypeScript **v0.57.0**: [`Source/Core/build/preflight.ts`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Source/Core/build/preflight.ts) — validator construction without command or tenant state.
- Arc **v22.45.0**: [`Source/DotNET/Arc.Core/Validation/DiscoverableValidators.cs`](https://github.com/Cratis/Arc/blob/v22.45.0/Source/DotNET/Arc.Core/Validation/DiscoverableValidators.cs) — validator activation.
- Arc **v22.45.0**: [`Source/DotNET/Arc.Core/Queries/ReadModelForCommandServiceCollectionExtensions.cs`](https://github.com/Cratis/Arc/blob/v22.45.0/Source/DotNET/Arc.Core/Queries/ReadModelForCommandServiceCollectionExtensions.cs) — scoped read-model factories and asynchronous resolver bridge.
- Arc **v22.45.0**: [`Source/DotNET/Arc.Core/DependencyInjection/ParameterDependencyResolver.cs`](https://github.com/Cratis/Arc/blob/v22.45.0/Source/DotNET/Arc.Core/DependencyInjection/ParameterDependencyResolver.cs) — nullable and required dependency handling.
