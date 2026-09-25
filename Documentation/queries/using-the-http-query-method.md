---
title: Using the HTTP QUERY method
description: Send query arguments, paging, and sorting as a JSON body with the HTTP QUERY method, and turn the method off when you only want GET.
---

A query string flattens everything into text. When a query takes structured arguments, or you would rather not put values in a URL, send them in a body with the HTTP `QUERY` method. It is safe and idempotent like GET, and Arc accepts it on every query route by default.

## Send a QUERY request

```bash
curl -X QUERY http://127.0.0.1:3000/api/tasks/listing/task-by-id \
  -H 'content-type: application/json' \
  -d '{"arguments":{"id":"1a638f8e-4444-4444-8888-a0b10cdd9977"}}'
```

Against the running Tasks sample, this answers 200 with the task in `data` and `Cache-Control: no-store`.

## The body

The body is a JSON object with three recognized properties. Unknown members of the envelope, paging, and sorting objects are ignored:

```json
{ "arguments": { "tags": ["urgent"] }, "paging": { "page": 0, "pageSize": 10 }, "sorting": { "field": "title", "direction": "desc" } }
```

| Property | Meaning |
| --- | --- |
| `arguments` | Parsed as JSON, so numbers, booleans, arrays, and objects keep their types. Names match case-insensitively, as with GET |
| `paging` | `page` and `pageSize`. Nonpositive or missing `pageSize` means unpaged. |
| `sorting` | `field` and `direction`; a direction without a field is ignored. |

GET and QUERY have different paging rules; see the [request table](model-bound/paging.md#request-parameters). Undeclared argument names are rejected by TypeScript (unlike .NET).

## Turn it off

Set `generatedApis: { enableQueryHttpMethod: false }` in the [options](../configuration/index.md#the-arcoptions-tree) to accept GET only. A `QUERY` request then answers 405 with `Allow: GET`.

## Where QUERY does not appear

OpenAPI 3.1 path items do not define a `QUERY` operation, so [`/openapi.json`](../open-api/index.md) describes queries as GET only. Behind Fastify, `QUERY` is registered for command and query routes but not for the `/.cratis` endpoints.

## Related

- [Query arguments](model-bound/query-arguments.md)
- [Arc HTTP contract](/arc/http-contract/)
