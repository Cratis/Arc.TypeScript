---
title: Introspection
description: Ask a running Arc application which commands and queries it serves, with routes and input JSON Schema, from the anonymous /.cratis introspection endpoints, and know what they expose.
---

You open a service you did not write, or one you wrote six months ago, and need to know what it accepts. Reading every feature folder takes a while. A developer tool, a contract test, or an AI assistant helping you has the same problem, and often cannot read the source at all.

So ask the running application. Arc describes itself at three endpoints, built from the same metadata that binds requests, so the answer is never out of date.

| Endpoint | Returns |
| --- | --- |
| [`GET /.cratis/commands`](commands.md) | Every command, with its route and payload schema |
| [`GET /.cratis/queries`](queries.md) | Every query, with its route, full name, and arguments schema |
| [`GET /.cratis/identity-details/schema`](identity-details-schema.md) | The JSON Schema of the identity details `/.cratis/me` returns |

## Try it

Start the Tasks sample and ask for its commands:

```bash
curl http://127.0.0.1:3000/.cratis/commands
```

You get one entry for `RegisterTask`, with the route `/api/tasks/registration/register-task` and a JSON Schema that requires a UUID `id` and a string `title`. [Command introspection](commands.md) shows the full answer. The queries endpoint lists `allTasks`, `taskById`, and `observeAllTasks` the same way.

Behind that answer there is no extra registry. Arc builds the list from the operations it compiled at startup, and the schemas from the `@field` declarations or Zod schemas that also validate incoming requests. Rename a field, restart, and the endpoint shows the new name.

## What it exposes, and to whom

The endpoints are anonymous. They do not run authentication handlers, and they list every operation whether or not a caller may run it. Treat names, routes, and input shapes as public information about your API. They never include data.

They accept only GET; other methods answer 405 with `Allow: GET`. They are always mapped, in development and production alike. If the list of operations must stay private, block these paths at your ingress.

## How it relates to OpenAPI and proxies

Introspection, [`/openapi.json`](../open-api/index.md), and the [proxy generator](../proxy-generation/index.md) all see the same schemas. They serve different readers:

| Use | For |
| --- | --- |
| Introspection | Arc-aware tools that need Arc's own names: the fully qualified query name for hub subscriptions, or the `/validate` route of a command |
| OpenAPI | General HTTP tooling: API clients, gateways, and code generators for other languages |
| Proxy generator | Your TypeScript frontend, generated from source at build time without a running server |

[How types appear in the document](../open-api/schemas.md) explains how concepts, enums, and optional fields are rendered, and applies to the introspection schemas too. [Concepts in the document](../open-api/concepts.md) and [Enums in the document](../open-api/enums.md) go into detail.

## Related

- [Endpoint mapping](../core/endpoint-mapping.md)
- [HTTP contract reference](../reference/http-contract.md)
