---
title: HTTP contract reference
description: Every route Arc for TypeScript serves, its methods and answers, the headers it reads and writes, and where its wire behavior differs from Arc on .NET.
---

The language-neutral [Arc HTTP contract](/arc/http-contract/) is the specification: routes, methods, headers, result envelopes, status codes, identity, and validation values. This page lists what Arc for TypeScript serves against it. The status of each difference, and the evidence for it, is in the [capability reference](capabilities.md#deliberate-differences).

## Routes

| Path | Methods | Answer |
| --- | --- | --- |
| A command route, such as `/api/tasks/registration/register-task` | POST | Command result |
| `<command route>/validate` | POST | Command result after authorization and validation; the handler never runs |
| A query route, such as `/api/tasks/listing/all-tasks` | GET, and `QUERY` unless disabled | Query result; `QUERY` responses carry `Cache-Control: no-store` |
| An observable query route | GET, `QUERY`, SSE with `Accept: text/event-stream`, direct WebSocket upgrade | Current snapshot, a stream of direct SSE results, or direct WebSocket `Data` frames |
| `/.cratis/queries/ws` | WebSocket upgrade | Multiplexed WebSocket hub |
| `/.cratis/queries/sse`, `/.cratis/queries/sse/subscribe`, `/.cratis/queries/sse/unsubscribe` | GET, and authenticated POST | Multiplexed SSE stream and its caller-bound controls |
| `/.cratis/commands`, `/.cratis/queries` | GET | Command and query metadata with input JSON Schema |
| `/.cratis/identity-details/schema` | GET | Identity details JSON Schema, or `{}` |
| `/.cratis/me` | GET, when an identity details provider exists | 401 anonymous, 403 provider denied, 200 identity JSON with display cookie |
| `/.cratis/users`, `/.cratis/tenants` | GET | `[]` by default; opt-in development discovery |
| `/.cratis/queries/health` | GET and `QUERY`, when enabled | Caller-scoped hub health; requires authentication |
| `/openapi.json` | GET | OpenAPI 3.1 document |

The description endpoints do not run authentication handlers. Methods that reach Arc but are not accepted answer 405 with an `Allow` header. Route shapes are explained in [Endpoint mapping](../core/endpoint-mapping.md).

## Headers

| Header | Direction | Meaning |
| --- | --- | --- |
| `X-Correlation-ID` (configurable) | Request and response | Reused when a valid non-zero UUID, otherwise replaced; always returned |
| `X-Allowed-Severity` | Request | `0`, `1`, or `2` on commands; `3` is capped to `2`; ignored on queries |
| `x-cratis-tenant-id` (configurable) | Request | The requested tenant without `tenancy.resolve` or another configured tenant source |
| `Authorization` | Request | Read only by the authentication handlers you configure |
| `Cache-Control: no-store` | Response | On `QUERY` responses and `/.cratis/me` |
| `Allow` | Response | On 405 answers |
| `Retry-After: 1` | Response | On observable admission 503 answers |

## Status codes

A result is 200 when successful, then 403 for authorization failures, 400 for validation and malformed input, 202 for a pending observable snapshot, and 500 for exceptions, in the contract's order. 401 answers an anonymous caller on a protected operation when authentication handlers are configured, and any failed authentication. Observable routes also use 408 for a timed-out first-result wait and 503 when a limit is reached.

## Where the TypeScript server differs

| Area | Arc on .NET | Arc for TypeScript |
| --- | --- | --- |
| `X-Allowed-Severity: 3` | Runs a command with only error results | Treated as Warning; errors block |
| Anonymous caller on a protected operation | 403 | 401 when handlers are configured |
| Malformed request message | Framework message | `Malformed request` |
| Redacted exception message | Framework message | `An unexpected error occurred` |
| Invalid GUID query argument | Binds `Guid.Empty`, 200 | 400 `malformedRequest` |
| SSE hub | Anonymous controls allowed | Requires an authenticated principal |
| Query health | Anonymous, cross-caller | Opt-in, caller-scoped |
| `waitForFirstResultTimeout` | Larger values accepted; unknown booleans ignored | At most 120 seconds; unknown booleans rejected |

The suite also pins three differences observed in the .NET reference host that are not choices of Arc for TypeScript:

| Request | Arc on .NET 22.23.0 | Arc for TypeScript |
| --- | --- | --- |
| A numeric concept query argument on GET | Redacted 500 ([Cratis/Arc#2757](https://github.com/Cratis/Arc/issues/2757)) | Binds the value, 200 |
| GET with `sortBy` and `sortDirection` | Ignores the sort ([Cratis/Arc#2758](https://github.com/Cratis/Arc/issues/2758)); the equivalent `QUERY` request sorts identically on both | Applies the sort |
| An unknown path under Express | Empty 404 with a correlation header | Express's own HTML 404, without an Arc correlation header |

The paired `yarn test:conformance` suite pins these differences against a .NET host on `Cratis.Arc` 22.23.0; see [How parity is checked](capabilities.md#how-parity-is-checked).

## Related

- [Arc HTTP contract](/arc/http-contract/)
- [Capability reference](capabilities.md)
