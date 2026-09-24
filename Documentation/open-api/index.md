---
title: OpenAPI
description: Read the OpenAPI 3.1 document Arc serves at /openapi.json for every registered command and query, and know what it describes and what it leaves out.
---

API gateways, testing tools, and non-Arc clients understand OpenAPI. Arc serves an OpenAPI 3.1 document for every registered command and query at `GET /openapi.json`, generated from the same schemas that bind requests, so it cannot drift from what the server accepts.

## Read the document

```bash
curl http://127.0.0.1:3000/openapi.json
```

For the Tasks sample, the command entry looks like this:

```json
{
  "openapi": "3.1.0",
  "info": { "title": "Arc", "version": "0.1.0" },
  "paths": {
    "/api/tasks/registration/register-task": {
      "post": {
        "operationId": "Tasks.Registration.RegisterTask",
        "summary": "",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "properties": { "id": { "type": "string", "format": "uuid" }, "title": { "type": "string" } }, "required": ["id", "title"] } } } },
        "responses": { "200": { "description": "Result" }, "400": { "description": "Invalid request" }, "403": { "description": "Not authorized" }, "500": { "description": "Server error" } }
      }
    }
  }
}
```

The schema is shortened here; the real one also carries `$schema` and the UUID `pattern`.

## What it describes

| Operation | Described as |
| --- | --- |
| Command | `POST` with a required JSON request body holding the input schema |
| Query | `GET` with one query parameter per argument, marked required as in the schema |
| Observable query | `GET`, with a `text/event-stream` 200 response and 202, 408, and 503 responses |

`operationId` is the operation's namespace and name, and `summary` is a low-level definition's `summary`. Concepts appear as their underlying scalar, and polymorphic fields as `oneOf` of their registered variants.

## What it leaves out

- Result schemas: responses carry descriptions, not the result envelope's shape.
- The HTTP `QUERY` method, which OpenAPI 3.1 path items do not define.
- Command `/validate` routes and the `/.cratis` endpoints.
- `pathBase` from the standalone host; paths are not rewritten.
- Model-bound summaries: `@command()` and `@readModel()` have no summary option, so `summary` is empty.

`info.title` is always `Arc`, and `info.version` is a fixed `0.1.0` for the document format, not your application or package version. There is no bundled Swagger UI; point a UI of your choice at `/openapi.json`.

The document is served anonymously. It does not run authentication handlers.

## Related

- [Introspection](../introspection/index.md) for Arc's own metadata endpoints
- [Endpoint mapping](../core/endpoint-mapping.md)
