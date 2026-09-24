---
title: Model-bound JSON wire format
description: Understand derived-type discriminators, acronym naming, enum values and named floating-point literals.
---
<!-- Copyright (c) Cratis. All rights reserved.
Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

A model-bound `@field(Base)` or array of `Base` can contain a registered
Fundamentals derivative. Decorate each concrete subclass with
`@derivedType('identifier')` and load its module before building the server.
Arc requires a known `_derivedTypeId` in the input for a polymorphic base and
materializes the concrete subclass; an unknown or missing ID is rejected. The
output includes `_derivedTypeId` **after** the concrete fields. Introspection
and OpenAPI input JSON Schema describe the registered variants with `oneOf`.
The source proxy generator emits the same `@derivedType` declaration; the
published Fundamentals client uses `_derivedTypeId` to select a registered
class for **declared model fields** on response deserialization. The published
client does not currently select a derivative for a top-level command response
declared as the base type. Wrap it in a DTO with a decorated base-typed field
when the response itself is polymorphic. This is a client limitation, not a
server-side discriminator fallback.

```json
{ "title": "hello", "text": "world", "_derivedTypeId": "text" }
```

Like the .NET JSON policy, Arc lowercases the initial letter of an ordinary
PascalCase field (`RecordedValue` → `recordedValue`) but keeps a leading acronym
(`HTTPCount` stays `HTTPCount`). Numeric TypeScript enum members configured
with `@enumeration` remain numeric on the wire, as do .NET enums. String enums
remain strings. Nonfinite `Number` values use JSON strings `"NaN"`, `"Infinity"`
and `"-Infinity"`; ordinary finite values remain JSON numbers. Null properties
are omitted from model output, but an explicit nullable input is still accepted.
The low-level Zod path is not a CLR JSON converter and retains its declared
schema and input binding rules.

Node has no CLR per-thread culture. Arc parses query-string numbers through
explicit numeric conversion and serializes wire values without using the
process locale. Array sorting currently uses JavaScript's `localeCompare`:
it is not equivalent to .NET invariant-culture collation. Specify provider
sorting when stable cross-platform order matters. The optional
`ArcServerOptions.correlationHeader` chooses the ingress **and response**
header name (default `X-Correlation-ID`); invalid/non-UUID IDs are replaced.
It does not change W3C `traceparent` propagation or instrument foreign routes.
