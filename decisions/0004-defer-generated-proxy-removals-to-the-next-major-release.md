---
id: 0004-defer-generated-proxy-removals-to-the-next-major-release
title: Defer generated-proxy breaking changes to the next major release
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

Generated proxies are public API for every application that regenerates them. The [framework rules](../.cratis/ai/rules/framework.md) say that "a change to a public type, attribute, interface, or generated-proxy shape is a breaking change", and this repository makes no major release until parity with Arc for .NET is verified and a human merges it. Two fixes therefore keep the old shape instead of changing it:

- [#174](https://github.com/Cratis/Arc.TypeScript/issues/174) (v0.57.1): the `sortBy` helpers for record, nested-model, array, map and polymorphic fields are deprecated, not removed. In-memory sorting on those fields is rejected; database providers sort them in their own order.
- [#178](https://github.com/Cratis/Arc.TypeScript/issues/178) (v0.58.0): `--scalar-concept-subclasses` is opt-in. It types indirect and generic concept subclasses (for example `class DerivedName extends Name`) as their underlying value. By default they are still generated as empty model classes, and the empty class hydrates without its value, so the value is lost at runtime. Typing them as their value fixes that but changes field and parameter types, which breaks code that assigns, passes or tests for the class. With the option on, the empty classes are still emitted, deprecated.

## Decision

In the next major release:

- remove the deprecated complex-field `sortBy` helpers;
- make scalar typing of indirect and generic concept subclasses the default, by removing `--scalar-concept-subclasses` or inverting it, and remove the empty classes.

Until then nothing changes by default: generated output stays as it was, and the opt-in is the only way to get the new types. This record, not an issue, tracks the removals; the deprecation text in generated proxies links here.

## Options considered

- **Change or remove now (rejected).** Breaks compilation for consumers that reference the members, outside a major release.
- **Keep indefinitely (rejected).** Leaves misleading API and lost values in every generated proxy.
- **Opt in or deprecate now, change the default in the next major (chosen).**

## Default if unanswered

Generated output is unchanged; the deprecated helpers stay and the option stays off.

## Timeline and scope

Applies until the next major release of Arc for TypeScript. Further breaking changes to generated proxies that are deferred this way are added to the list under Context.

## Verification

- **Done when:**
  - the next major release removes the deprecated `sortBy` helpers (migration: sort on a scalar field);
  - scalar concept-subclass typing is the default and the option no longer exists or is inverted (migration: use the concept's underlying value instead of the subclass);
  - the empty concept-subclass classes are no longer generated;
  - each has a `## Removed` or `## Changed` release-note entry with that migration guidance.
- **Verify by:** regenerate the samples and ContractTests/ProxyComparison and confirm the deprecated helpers and empty classes are absent, indirect concept fields are typed as their value without any option, and the remaining output is unchanged.

## Consequences

Until the major release, generated proxies carry deprecated members and applications opt in to the corrected concept typing; editors flag the deprecated members.

## Evidence

- `Source/Tools/ProxyGenerator/renderSourceQuery.ts` (deprecated complex-field `sortBy` helpers)
- `Source/Tools/ProxyGenerator/SourceTypeResolver.ts` (opt-in scalar typing of indirect and generic concepts)
