---
title: Introspection
description: List every command and query a running Arc application serves, with routes and input JSON Schema, from the anonymous /.cratis introspection endpoints.
---

When you need to know what a running backend exposes (for a developer tool, a test, or an AI assistant helping you), ask the backend. Arc serves its own metadata at three anonymous endpoints.

| Endpoint | Returns |
| --- | --- |
| [`GET /.cratis/commands`](commands.md) | Every command, with route and payload schema |
| [`GET /.cratis/queries`](queries.md) | Every query, with route, full name, and arguments schema |
| [`GET /.cratis/identity-details/schema`](identity-details-schema.md) | The JSON Schema of identity details |

```bash
curl http://127.0.0.1:3000/.cratis/commands
curl http://127.0.0.1:3000/.cratis/queries
```

These endpoints accept only GET; other methods answer 405 with `Allow: GET`. They do not run authentication handlers, so treat what they reveal (names, routes, and input shapes) as public. They never include data.

The schemas come from the same `@field` metadata or Zod schemas that bind requests, and match what [`/openapi.json`](../open-api/index.md) and the [proxy generator](../proxy-generation/index.md) see.

## Related

- [Endpoint mapping](../core/endpoint-mapping.md)
- [HTTP contract reference](../reference/http-contract.md)
