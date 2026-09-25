---
title: OpenAPI
description: Inspect command and query request and result envelopes at /openapi.json, and configure the advertised application version.
---

Arc serves an OpenAPI 3.1 document at `GET /openapi.json`. Route paths follow [endpoint mapping](../core/endpoint-mapping.md). It describes registered commands as `POST` and queries as `GET`, including observable queries. Set `generatedApis.openApiVersion` when constructing the server or builder to advertise your application's version; the default remains `0.1.0`.

```typescript
const server = new ArcServer({ generatedApis: { openApiVersion: '2.3.0' } });
```

Fetch the document with `curl http://127.0.0.1:3000/openapi.json`. The document is public; this endpoint does not run authentication handlers. Host an OpenAPI UI separately if needed. Arc does not bundle a Swagger or Scalar UI.

## Operation descriptions

For example, a registered `Tasks.Save` command on `/api/tasks/save` appears under `paths` with a `post` operation (excerpt):

```json
{
  "openapi": "3.1.0",
  "paths": {
    "/api/tasks/save": {
      "post": {
        "operationId": "Tasks.Save",
        "tags": ["Tasks"],
        "responses": {
          "200": { "description": "Result" },
          "400": { "description": "Invalid request" }
        }
      }
    }
  }
}
```

The full document also includes `info`, request and result schemas, and the other responses; fetch it from your running server rather than using this excerpt as a complete OpenAPI document.

Each operation has a namespace-qualified `operationId`, a namespace tag, and a summary. Low-level definitions can provide `summary` directly. For model-bound artifacts, run the proxy generator with `--metadata` and register its output via `useGeneratedMetadata()` to supply JSDoc class and query-method summaries at runtime; otherwise the summary is empty. Command inputs use their JSON request schema; query arguments are GET parameters with required flags from the input schema. GET also accepts `page`, `pageSize`, `sortBy`, and `sortDirection` for many, paged, or unknown result cardinality (not known single-result queries); observable queries additionally accept `waitForFirstResult` and `waitForFirstResultTimeout` (fractional seconds greater than zero and at most 120). A bound argument with one of these names appears only once. Repeating an array argument sends multiple values under the same name.

A 200 response has the Arc `CommandResult` or `QueryResult` envelope, with `response` or `data` when its source-declared result is available in registered generated artifact metadata. A paged query has an array-valued `data` and a `paging` object (`page`, `size`, `totalItems`, `totalPages`). Observable queries describe both the JSON snapshot and direct `text/event-stream` response, along with 202, 408, and 503. The 202, 408, and 503 responses also carry a JSON `QueryResult` envelope. The 400, 403, and 500 responses describe failure envelopes without typed `response` or `data`; actual error status can vary by request and authorization failure (including 401).

When no generated return metadata exists, the document **omits `response` or `data`** rather than guessing from the input schema or executing the handler. The result remains valid at runtime; only its response payload type is unavailable to OpenAPI. Decorated model results are converted using the same wire schema as inputs: concepts use their primitive value, and registered derived types have discriminated variants. A low-level definition can provide a summary but does not have a generated result type.

Protected operations advertise HTTP bearer security only when the operation authenticates with a default `jwtBearer()` handler or explicitly selects a named JWT scheme; anonymous operations do not. A named-only handler does not authenticate operations using the default handlers. If a named scheme is called `bearer`, the default bearer component is called `arcBearer`. Arc cannot infer the protocol of a custom handler, so it does not advertise one as bearer. Native-principal authentication is supplied by the host and has no bearer scheme in this document.

## Not included

OpenAPI path items cannot represent the optional HTTP `QUERY` method. The document also omits command `/validate` routes, `/.cratis` endpoints, and standalone-host `pathBase` rewriting. For Arc-specific metadata endpoints, see [Introspection](../introspection/index.md).
