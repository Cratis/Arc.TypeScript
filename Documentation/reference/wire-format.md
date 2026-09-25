---
title: Wire format
description: Understand derived-type discriminators, acronym naming, enum values and named floating-point literals.
---

A payload that looks right in one client can still fail to round-trip in another: a subclass arrives as its base type, an acronym changes case, or `NaN` breaks a JSON parser. This page lists the rules Arc for TypeScript follows when it reads and writes models, and where they match Arc on .NET.

## Derived types

A model-bound `@field(Base)`, or an array of `Base`, can contain a registered Fundamentals derivative:

- Decorate each concrete subclass with `@derivedType('identifier')` and load its module before building the server.
- For a polymorphic base, Arc requires a known `_derivedTypeId` in the input and materializes the concrete subclass. An unknown or missing ID is rejected.
- In a multi-level hierarchy, a decorated intermediate type accepts its own ID and the IDs of its registered descendants.
- Output includes `_derivedTypeId` **after** the concrete fields, and only when the field's declared type has derivatives. An untyped top-level response does not acquire a discriminator automatically.
- Introspection and the OpenAPI input JSON Schema describe the registered variants with `oneOf`.

```json
{ "title": "hello", "text": "world", "_derivedTypeId": "text" }
```

The source proxy generator emits the same `@derivedType` declaration. On response deserialization, the published Fundamentals client uses `_derivedTypeId` to select a registered class for **declared model fields**. It does not currently select a derivative for a top-level command response declared as the base type. When the response itself is polymorphic, wrap it in a DTO with a decorated base-typed field. This is a client limitation, not a server-side discriminator fallback.

## Property names

Like the .NET JSON policy, Arc lowercases the initial letter of an ordinary PascalCase field (`RecordedValue` becomes `recordedValue`) but keeps a leading acronym (`HTTPCount` stays `HTTPCount`).

Plain objects, dictionary keys, and introspection and OpenAPI schema property names are never renamed.

## Enums and numbers

- Numeric TypeScript enum members configured with `@enumeration` remain numeric on the wire, as .NET enums do. String enums remain strings.
- Nonfinite `Number` values use the JSON strings `"NaN"`, `"Infinity"`, and `"-Infinity"`. Ordinary finite values remain JSON numbers.
- Inputs for numeric fields are finite-only. The field option that accepts the three named literals on input is internal: `@cratis/arc.core` does not export it yet.

## Null values

Null properties are omitted from ordinary model output. A derived model serialized through a polymorphic field keeps its null fields. An explicit nullable input is accepted.

## The low-level Zod path

The low-level Zod path is not a CLR JSON converter. It keeps its declared schema and input binding rules.

## Culture and sorting

Node has no CLR per-thread culture. Arc parses query-string numbers through explicit numeric conversion and serializes wire values without using the process locale.

Array sorting currently uses JavaScript's `localeCompare`, which is not equivalent to .NET invariant-culture collation. Sort in the provider when stable cross-platform order matters.

## Correlation header

The optional `ArcOptions.correlationId.httpHeader` chooses the ingress **and response** header name; the default is `X-Correlation-ID`. Invalid or non-UUID IDs are replaced. The setting does not change W3C `traceparent` propagation or instrument foreign routes.

## Related

- [HTTP contract](http-contract.md)
- [Configuration](../configuration/index.md)
- [Observe Arc requests](../observability.md)
