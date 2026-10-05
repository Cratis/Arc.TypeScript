---
id: 0004-defer-generated-proxy-removals-to-the-next-major-release
title: Defer removals of deprecated generated-proxy members to the next major release
status: accepted
stage: none
class: contract
reversibility: cheap
decided: 2026-10-05
decider: Sindre Alstad Wilting
applies-to:
  - Source/Tools/ProxyGenerator/**
  - ContractTests/ProxyComparison/**
  - Documentation/proxy-generation/**
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

## Context

Generated proxies are public API for every application that regenerates them. Removing or renaming a generated member is a breaking change ([framework rules](../.cratis/ai/rules/framework.md)), and this repository makes no major release until parity with Arc for .NET is verified and a human merges it. Two fixes therefore deprecated generated members instead of removing them:

- [#174](https://github.com/Cratis/Arc.TypeScript/issues/174) (v0.57.1): `sortBy` helpers for record, nested-model, array, map and polymorphic fields. In-memory sorting on those fields is rejected; database providers sort them in their own order.
- [#178](https://github.com/Cratis/Arc.TypeScript/issues/178) (v0.58.0): the empty classes generated for indirect and generic concept subclasses, which fields and parameters no longer reference.

## Decision

Keep both kinds of member, marked `@deprecated`, until the next major release, and remove them there. This record, not an open issue, tracks the removal; [#177](https://github.com/Cratis/Arc.TypeScript/issues/177) is closed in favor of it.

## Options considered

- **Remove now (rejected).** Breaks compilation for consumers that reference the members, outside a major release.
- **Keep indefinitely (rejected).** Leaves misleading API in every generated proxy.
- **Deprecate now, remove in the next major (chosen).**

## Default if unanswered

The members stay deprecated; nothing breaks.

## Timeline and scope

Applies until the next major release of Arc for TypeScript. Further deprecations of generated members are added to this list.

## Verification

- **Done when:** the next major release removes every member listed under Context, with a `## Removed` release-note entry and migration guidance (sort on a scalar field; use the concept's scalar type).
- **Verify by:** regenerate the samples and ContractTests/ProxyComparison and confirm the members are absent and the remaining output is unchanged.

## Consequences

Generated proxies carry deprecated members until then; editors flag their use.

## Evidence

- `Source/Tools/ProxyGenerator/renderSourceQuery.ts` (deprecated complex-field `sortBy` helpers)
- `Source/Tools/ProxyGenerator/SourceTypeResolver.ts` (indirect and generic concept resolution)
