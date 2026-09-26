---
title: OpenAPI
description: Hand API consumers and tools an OpenAPI 3.1 description of every command and query at /openapi.json, with request schemas, result envelopes, and bearer security, without writing it by hand.
---

A partner team wants to call your task API from Python. A QA engineer wants the endpoints in their API client. Your gateway wants a contract to validate against. Writing that description by hand means it is wrong the week after someone adds a field.

Arc writes it for you. Every running Arc application serves an OpenAPI 3.1 document at `GET /openapi.json`, built from the same `@field` declarations and Zod schemas that bind requests. When the code changes, the document changes with it.

## Fetch the document

```bash
curl http://127.0.0.1:3000/openapi.json
```

For the Tasks sample, with its generated metadata registered, the `RegisterTask` command appears under `paths` like this (excerpt, `responses` left out):

```json
"/api/tasks/registration/register-task": {
  "post": {
    "operationId": "Tasks.Registration.RegisterTask",
    "tags": ["Tasks.Registration"],
    "summary": "Register a task.",
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {
          "schema": {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
              "id": { "type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", "format": "uuid" },
              "title": { "type": "string" }
            },
            "required": ["id", "title"]
          }
        }
      }
    }
  }
}
```

The summary is the JSDoc comment on the `RegisterTask` class. `TaskId` and `TaskTitle` are concepts, so they appear as the UUID string and the string they wrap. Fetch the document from your running server to see the responses in full.

Nothing about this needs setup: the route exists as soon as the application runs. The document is public, and the endpoint does not run authentication handlers. Arc does not bundle a Swagger or Scalar UI; point one you host at `/openapi.json` if you want a browsable page.

## What each operation contains

- **Identity.** A namespace-qualified `operationId`, such as `Tasks.Registration.RegisterTask`, a tag for the namespace, and a summary. Route paths follow [endpoint mapping](../core/endpoint-mapping.md).
- **Input.** A command's JSON request body schema, or a query's arguments as GET parameters, with `required` taken from the input schema. Queries that can return a list, or whose result type is unknown, also accept `page`, `pageSize`, `sortBy`, and `sortDirection`. Observable queries add `waitForFirstResult` and `waitForFirstResultTimeout`.
- **Responses.** The Arc `CommandResult` or `QueryResult` envelope for 200, 400, 403, and 500. Observable queries also describe 202, 408, and 503, and a `text/event-stream` response. A paged result carries `paging` with `page`, `size`, `totalItems`, and `totalPages`.
- **Security.** HTTP bearer security, when the operation authenticates with a `jwtBearer()` handler.

## Topics

| Page | What it covers |
| --- | --- |
| [Concepts](concepts.md) | Concepts, GUIDs, dates, and models described as the JSON value they carry |
| [Commands](commands.md) | The POST operation, request body, `CommandResult` envelope, and typed `response` |
| [Queries](queries.md) | GET parameters, paging and sorting, observable options, and the `QueryResult` envelope |
| [Enums](enums.md) | `@enumeration` values for numeric and string enums |
| [Model-bound and low-level operations](model-bound.md) | Where each part of an operation comes from, for decorators and `define*` definitions |
| [How types appear in the document](schemas.md) | One worked example, plus optional, nullable, defaulted, and derived fields |

Arc on .NET also documents its C#-only `[FromRequest]` binding; Arc for TypeScript binds a command from the JSON body and a query from its arguments, so it has no counterpart.

## Summaries and result types need generated metadata

Arc reads your source only through the metadata it has at runtime. Two parts of the document depend on [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md) registered with `useGeneratedMetadata()`:

- **Summaries.** JSDoc on a command class or query method becomes the operation summary. Without metadata the summary is empty. A low-level definition sets `summary` directly.
- **Result types.** The 200 envelope includes a typed `response` or `data` only when the metadata declares the return type. Without it, the document **omits** `response` or `data` rather than guess from the input schema or run the handler. The runtime result is the same; only its description is missing.

The Tasks sample registers its metadata, so its `registerTask` response is described as a UUID string and `allTasks` as an array of `TaskItem`.

## Set the advertised version

`info.version` defaults to `0.1.0`. Set your application's version with `generatedApis.openApiVersion`, in code or as `Cratis:Arc:GeneratedApis:OpenApiVersion` in configuration:

```typescript
const server = new ArcServer({ generatedApis: { openApiVersion: '2.3.0' } });
```

## Bearer security

An operation that requires authentication advertises HTTP bearer security when it authenticates with a default `jwtBearer()` handler, or explicitly selects a named JWT scheme. Anonymous operations advertise none. A named-only handler does not authenticate operations that use the default handlers. If a named scheme is called `bearer`, the default bearer component is called `arcBearer`.

Arc cannot infer the protocol of a custom handler, so it never advertises one as bearer. A [native principal](../hosts/native-principal.md) is authenticated by the host and has no security scheme in this document.

## What the document leaves out

- **HTTP `QUERY`.** OpenAPI path items cannot represent it, so queries appear as GET only.
- **Command `/validate` routes** and the `/.cratis` endpoints. [Introspection](../introspection/index.md) describes those.
- **`pathBase`.** Paths are not rewritten for a standalone host `pathBase`.
- **Every status the runtime can return.** A request can also answer 401, for example, which the operation does not list.

## Recap

- `GET /openapi.json` is always on, public, and generated from the same schemas that bind requests.
- Register generated metadata to get summaries and typed results.
- Set `generatedApis.openApiVersion` to advertise your version.

Next, see [how concepts appear in the document](concepts.md).
