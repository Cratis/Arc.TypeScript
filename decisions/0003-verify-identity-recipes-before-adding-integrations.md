---
id: 0003-verify-identity-recipes-before-adding-integrations
title: Verify identity recipes before adding optional integrations
status: accepted
stage: none
class: contract
reversibility: costly
decided: 2026-10-02
decider: Sindre Alstad Wilting (delegated to the maintainer's AI orchestrator session)
applies-to:
  - Source/Core/authentication/**
  - Source/Core/identity/**
  - Source/Core/package.json
  - Documentation/core/authentication.md
  - Documentation/hosts/native-principal.md
  - Documentation/identity/**
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

## Context

[#52](https://github.com/Cratis/Arc.TypeScript/issues/52) asks which identity integrations should follow the existing authentication surface. TypeScript v0.57.0 already provides `jwtBearer()` using `jose`, opt-in `microsoftIdentityPlatform()` for forwarded Microsoft principals, and an explicit native-principal bridge for host authentication. AuthProxy and EasyAuth produce the same forwarded-header protocol; they do not require separate adapters.

The inspected .NET v22.45.0 source has no Arc-owned Auth0, Keycloak, Entra OIDC-login or generic OIDC adapter. ASP.NET Core can host authentication middleware, but that is not an Arc implementation. Application identity enrichment through identity details and `/.cratis/me` is distinct from authentication. TypeScript's unsigned display cookie never authenticates a caller.

No known consumer has selected an identity provider or requested interactive login; this does not establish the absence of private consumers. Templates#61 remains authentication-neutral. Without a boundary, optional integrations can accumulate dependencies in core without a deployment requirement.

## Decision

No new provider implementation is added now. Entra ID API bearer authentication through `jwtBearer()` and AuthProxy/EasyAuth through `microsoftIdentityPlatform()` become verified deployment recipes using existing APIs. Any future OIDC integration requires a named consumer and concrete deployment requirement and belongs in a separate optional package, such as `@cratis/arc.oidc`. Core retains its authentication, principal and policy contracts and existing exports, but receives no further optional protocol or vendor dependencies; this choice does not extract or remove the existing JWT helper.

## Options considered

- **Verify recipes using existing handlers (chosen).** Addresses deployable configurations without adding a provider SDK or breaking existing exports.
- **Add Entra, Auth0 or Keycloak adapters to core now.** Rejected: no demonstrated need, and host middleware availability is not evidence of an Arc parity requirement.
- **Add provider-neutral OIDC discovery in an optional package now.** Deferred until a named consumer needs it. Discovery for bearer verification is the first candidate, not an implicit commitment to interactive login.
- **Move the existing JWT helper out of core immediately.** Rejected: unnecessary compatibility cost; preventing further optional dependencies does not require a breaking extraction.

## Default if unanswered

Existing handlers remain usable, but deployment trust requirements lack verified recipes. Speculative provider requests can expand core's dependency surface without a clear consumer or package boundary.

## Timeline and scope

The recipes are the next integration work, tracked by [#169](https://github.com/Cratis/Arc.TypeScript/issues/169). Acceptance does not mean the recipes have been verified. The boundary holds until superseded; reopen coded integration work only for a named consumer with a concrete deployment requirement. Neither the recipes nor an OIDC package block Templates#61.

The Entra recipe covers tenant-specific issuer/JWKS, API audience, allowed algorithms, access tokens rather than ID tokens, app roles, and scope-based named policies. The AuthProxy/EasyAuth recipe covers header stripping, blocked direct backend access, and the distinction between forwarded provider metadata and a durable provider key. Observable transports need their own authentication guidance: scheme-protected observables are currently rejected. Interactive login sessions, callbacks, refresh-token storage and speculative vendor packages are out of scope.

## Verification

- **Done when:** runnable Entra bearer and AuthProxy/EasyAuth configurations use existing handlers without a provider SDK; documentation states ingress trust and observable-transport constraints, and tests show that identity enrichment and the display cookie cannot establish a principal.
- **Verify by:** exercise authorization and `/.cratis/me` under #169; test issuer, audience and expiry failures, roles versus scopes, reserved forwarded-claim handling, and attempted display-cookie authentication. Verify the stated ingress requirements against the recipe deployment rather than assuming headers are trustworthy.

## Consequences

Applications gain verified guidance without new core dependencies or an export migration. Deployment owners remain responsible for the trust boundary around forwarded headers. Generic discovery and vendor-specific or interactive flows remain unavailable as new Arc integrations until a consumer justifies them. An optional OIDC package can evolve separately while composing the existing authentication contracts.

## Evidence

Paths below refer to the inspected tags, not moving branch heads.

- Arc.TypeScript **v0.57.0**: [`Source/Core/authentication/jwtBearer.ts`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Source/Core/authentication/jwtBearer.ts) — existing JWT verification helper.
- Arc.TypeScript **v0.57.0**: [`Documentation/core/authentication.md`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Documentation/core/authentication.md) — authentication handlers, policies and transport limits.
- Arc.TypeScript **v0.57.0**: [`Documentation/hosts/native-principal.md`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Documentation/hosts/native-principal.md) and [`Documentation/identity/contracts.md`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Documentation/identity/contracts.md) — host principal and identity-enrichment boundaries.
- Arc **v22.45.0**: [`Source/DotNET/Arc/MicrosoftIdentityPlatformIdentityServiceCollectionExtensions.cs`](https://github.com/Cratis/Arc/blob/v22.45.0/Source/DotNET/Arc/MicrosoftIdentityPlatformIdentityServiceCollectionExtensions.cs) — forwarded Microsoft identity integration.
- Arc **v22.45.0**: [`Documentation/backend/csharp/asp-net-core/microsoft-identity.md`](https://github.com/Cratis/Arc/blob/v22.45.0/Documentation/backend/csharp/asp-net-core/microsoft-identity.md) — EasyAuth and AuthProxy protocol documentation.
