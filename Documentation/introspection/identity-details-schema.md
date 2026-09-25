---
title: Identity details schema
description: The shape of GET /.cratis/identity-details/schema, which describes the application details returned by /.cratis/me.
---

A frontend or tool that shows identity details from another language cannot import your `detailsType` class. It can read its schema instead. `GET /.cratis/identity-details/schema` returns the JSON Schema of the `details` object that [`/.cratis/me`](../identity/index.md) returns. The schema comes from the identity details provider:

| Configuration | Response |
| --- | --- |
| A provider with `detailsType` | JSON Schema derived from the class's `@field` declarations |
| A provider with a Zod `schema` | That schema converted to JSON Schema |
| No provider, legacy `identityDetailsSchema` option | That object, unchanged |
| Neither | `{}` |

For a `detailsType` with one `@field(String) greeting` field:

```json
{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"greeting":{"type":"string"}},"required":["greeting"],"additionalProperties":false}
```

The endpoint is anonymous and does not run authentication handlers. It describes the shape only, never a user's data. The legacy `identityDetailsSchema` option cannot be combined with `identityDetails`.

## Related

- [Identity](../identity/index.md)
- [Introspection](index.md)
