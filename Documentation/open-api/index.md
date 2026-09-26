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

- **Identity.** A namespace-qualified `operationId`, such as `Tasks.Registration.RegisterTask`, a tag for the namespace, and a summary. Route paths follow [endpoint mapping](../core/endpoint-mapping.md). Every command also has a `POST <route>/validate` operation, with `:validate` appended to its execute operationId (for example, `Tasks.Registration.RegisterTask:validate`), even if the command itself is named `Validate`.
- **Input.** Execute and validate share the same required JSON request body and security requirements. Queries expose their arguments as GET parameters, with `required` taken from the input schema. Queries with declared array or provider-page results also advertise `page`, `pageSize`, `sortBy`, and `sortDirection`. Observable queries add `waitForFirstResult` and `waitForFirstResultTimeout`.
- **Responses.** The Arc `CommandResult` or `QueryResult` envelope for 200, 400, 403, and 500. The validation-only operation describes its **untyped** command result for 200, 400, 401, 403, and 500; it does not execute the handler or return a typed `response`. Observable queries also describe 202, 408, and 503, and a `text/event-stream` response. A paged result carries `paging` with `page`, `size`, `totalItems`, and `totalPages`.
- **Security.** HTTP bearer security, when the operation authenticates with a `jwtBearer()` handler.

[How types appear in the document](schemas.md) shows how concepts, enums, optional fields, and result types are described.

## Summaries and result types need generated metadata

Arc reads your source only through the metadata it has at runtime. Two parts of the document depend on [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md) registered with `useGeneratedMetadata()`:

- **Summaries.** JSDoc on a command class or query method becomes the operation summary. Without metadata the summary is empty. A low-level definition sets `summary` directly.
- **Result types.** The 200 envelope includes a typed `response` or `data` only when the metadata declares the return type. Without it, the document **omits** `response` or `data` rather than guess from the input schema or run the handler. The runtime result is the same; only its description is missing.

The Tasks sample registers its metadata, so its `registerTask` response is described as a UUID string and `allTasks` as an array of `TaskItem`. Without declared return cardinality, Arc cannot determine before execution whether a query will return an array, provider page, or scalar. The runtime still accepts paging and sorting on array or provider-page results, but the document conservatively omits those parameters for unknown results. Declare generated return metadata to advertise them. The four standard parameters use the same names and descriptions as the .NET OpenAPI integration. TypeScript additionally documents nonnegative `page`, positive `pageSize`, and the `ascending`/`descending` aliases accepted by its HTTP binder; .NET lists only `asc`/`desc` and uses `int32` schemas without these bounds.

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
- **The `/.cratis` endpoints.** [Introspection](../introspection/index.md) describes those.
- **`pathBase`.** Paths are not rewritten for a standalone host `pathBase`.
- **Every status the runtime can return.** A request can also answer 401, for example, which the operation does not list.

## Recap

- `GET /openapi.json` is always on, public, and generated from the same schemas that bind requests.
- Register generated metadata to get summaries and typed results.
- Set `generatedApis.openApiVersion` to advertise your version.

Next, see [how types appear in the document](schemas.md).
