---
id: 0001-keep-proxy-generation-focused-on-client-contracts
title: Keep proxy generation focused on compatible client contracts
status: accepted
stage: none
class: contract
reversibility: costly
decided: 2026-10-02
decider: Sindre Alstad Wilting
applies-to:
  - Source/Tools/ProxyGenerator/**
  - Documentation/proxy-generation/**
  - ContractTests/Client/**
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

> **2026-10-02 — clarification.** Sindre Alstad Wilting made and owns this decision; the decider attribution is corrected. The choice is unchanged.

## Context

[#50](https://github.com/Cratis/Arc.TypeScript/issues/50) asks how far the TypeScript source generator should follow .NET Arc. The comparison is TypeScript v0.57.0 against .NET v22.45.0. [Templates#61](https://github.com/Cratis/Templates/issues/61#issuecomment-5900368504) needs ordinary command, model and observable-query proxies, generated server metadata, and flat output. It does not establish demand for every .NET option. Without a scope boundary, compatibility work can become a port of .NET tooling rather than a usable client contract.

## Decision

Source generation stays focused on compatible client contracts and retains supported options. Namespace-root remapping, exclusions, library mode, source-file grouping, flags enums, dictionaries and other general wire-shape mappings, generated JSDoc, broader package/type mappings, identity-model discovery, and further validation extraction are added only for a demonstrated consumer need. Assembly loading, MSBuild/PDB mechanics, ASP.NET controller discovery, validator constructor execution, ineffective or obsolete .NET tracking switches, and .NET's whole-directory deletion are not ported. A bounded comparison with pinned .NET output is a verification instrument, not a universal byte-equality contract.

## Options considered

- **Consumer-led contract compatibility (chosen).** Preserves usable output and supported options without inheriting implementation mechanics or defects.
- **Port every .NET option and output shape.** Rejected: several inputs have no TypeScript equivalent, and no demonstrated consumer needs the remaining meaningful options now.
- **Require byte-identical output.** Rejected: formatting, type-only imports, source enum names and intentional semantic differences are not interoperability failures.
- **Use only existing substring assertions.** Rejected: they do not establish a representative, pinned cross-generator comparison.

## Default if unanswered

Existing generation continues, but the parity backlog has no stopping rule. Repeated comparisons can prioritize unused options or formatting over real client compatibility.

## Timeline and scope

This boundary applies now and until superseded. Reopen a deferred feature when a named consumer supplies a concrete contract or generation requirement. Retain project/artifact inputs, output and route options, interfaces, proxy suffixes, barrels, safe owned-file cleanup, shipped package/type mappings, and React-hook opt-out. `--root-namespace` is not .NET's namespace-to-output-folder remapping. Serialization compatibility must precede arbitrary wire-type overrides, and flags must never be inferred merely from numeric enum values.

The immediate work is [#166](https://github.com/Cratis/Arc.TypeScript/issues/166), protecting the Templates proxy and metadata contract, and [#167](https://github.com/Cratis/Arc.TypeScript/issues/167), building the bounded pinned comparison. Live Chronicle/MongoDB smoke testing remains in Templates. Copying destructive cleanup, conditional rules as unconditional rules, unsupported validators, or unsafe response-type guesses is out of scope.

## Verification

- **Done when:** representative paired command, snapshot-query, observable-query, model, enum and validation fixtures expose unreviewed differences; the Templates fixture produces flat `Register.ts`, `All.ts`, `Listing.ts`, barrels, matching routes and deterministic metadata, omits server-handled events, and preserves safe regeneration cleanup.
- **Verify by:** capture actual .NET 22.45.0 output and generator/package provenance; retain raw byte diffs, normalize only documented variable provenance headers, and review intentional differences explicitly. Compile both outputs against the pinned browser client and assert routes, descriptors, hydration and hook signatures. Run the Templates fixture's generation, frontend compilation and cleanup checks under #166 and #167.

## Consequences

Consumers keep supported generation behavior and gain a bounded compatibility signal. Unrequested generation features remain unavailable, and intentional differences need explicit review rather than automatic rejection. The comparison requires maintenance as pinned versions change; it cannot certify every possible source shape. No runtime or generator behavior changes merely by accepting this record.

## Evidence

Paths below refer to the inspected tags, not moving branch heads.

- Arc.TypeScript **v0.57.0**: [`Documentation/proxy-generation/configuration.md`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Documentation/proxy-generation/configuration.md) — supported configuration.
- Arc.TypeScript **v0.57.0**: [`Source/Tools/ProxyGenerator/SourceTypeResolver.ts`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Source/Tools/ProxyGenerator/SourceTypeResolver.ts) and [`renderRecordedRules.ts`](https://github.com/Cratis/Arc.TypeScript/blob/v0.57.0/Source/Tools/ProxyGenerator/renderRecordedRules.ts) — source type and validation extraction boundaries.
- Arc **v22.45.0**: [`Source/DotNET/Tools/ProxyGenerator/Program.cs`](https://github.com/Cratis/Arc/blob/v22.45.0/Source/DotNET/Tools/ProxyGenerator/Program.cs) — executable options and generation mechanics.
- Arc **v22.45.0**: [`Documentation/backend/csharp/proxy-generation/Configuration/index.md`](https://github.com/Cratis/Arc/blob/v22.45.0/Documentation/backend/csharp/proxy-generation/Configuration/index.md) and its option pages — .NET configuration contract.
- Arc **v22.45.0**: [`Source/DotNET/Tools/ProxyGenerator/Templates/TemplateTypes.cs`](https://github.com/Cratis/Arc/blob/v22.45.0/Source/DotNET/Tools/ProxyGenerator/Templates/TemplateTypes.cs) — generated output categories.
