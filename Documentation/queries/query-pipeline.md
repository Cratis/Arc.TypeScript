---
title: Query pipeline
description: The order in which Arc authenticates, authorizes, binds, and validates a query, then renders, intercepts, sorts, and pages its result.
---

A query goes through the same guard stages as a command, then a second set of stages that shape the result. Knowing the order tells you where a renderer, an interceptor, or a guard sees the data, and why a request for sorting can fail after your method already ran.

## Guard stages

| Step | You configure it with | When it fails |
| --- | --- | --- |
| 1. Authentication | `authentication` handlers, or a native principal | 401 |
| 2. Tenant | `tenancy.httpHeader`, `tenancy.sources`, or `tenancy.resolve` | 400 or 403 only when `tenancy` requires it |
| 3. Read arguments | The query string for GET, the body for `QUERY` | 400 `malformedRequest` for rejected input; an unreadable `QUERY` body produces a 400 exception envelope, while invalid paging produces a 400 `rule` result |
| 4. Declared authorization | `@roles`, `@authorize`, `@allowAnonymous`, or `authorization` | 403 |
| 5. Bind arguments | `argument(...)` descriptors, or a Zod `schema` | A wrong shape is held until global authorization finishes, then 400 `malformedRequest` |
| 6. Per-request authorization | `authorize(input, context)` on a successfully bound low-level definition | 403 |
| 7. Global authorization filters | Scoped `AuthorizationQueryFilter` services | 403 for denial; a thrown filter fails closed with 500 |
| 8. Global ordinary filters | Scoped `QueryPipelineFilter` services | 400 for validation, 500 for exceptions |
| 9. Validation | `QueryValidator`, concept validators, `validate`, `filters` | 400 with every result |
| 10. Perform | Your query method, or `perform` / `observe` | 500 when it throws |

The allowed severity for queries is always `Warning`. [Query filters](query-filters.md) run once at admission,
before validator and performer dependencies are constructed. A malformed schema shape reaches authorization filters
with raw arguments but does not reach ordinary filters; transport argument coercion errors return before filters.
These stages match the [command pipeline](../commands/command-pipeline.md).

## Result stages

After the method returns, Arc shapes the value in the same request or subscription scope:

1. **Renderers.** The first registered [renderer](renderers.md) whose `canRender` accepts the value turns it into data or a `queryPage`.
2. **Read-model interceptors.** Each registered [interceptor](read-model-interception.md) for the exact runtime class of an item transforms it, including items inside a provider-owned page.
3. **Sorting and paging.** An array is sorted, then paged, in memory. A `queryPage` is used as is. See [Paging and sorting](model-bound/paging.md).
4. **Encoding.** Decorated models and concepts become their wire shape.

For an observable query, the guard stages (including global query filters) run **once** when the subscription opens. Result stages 1 to 4 run for the current snapshot and for **every** emission, and [emission guards](observable-query-emission-guards.md) run after rendering, before each delivery. Cancellation after the performer or while resolving a renderer or interceptor waits for the active callback to settle, then fails without starting later callbacks or delivering successful data. In-flight effects are not undone; request and subscription scopes still close.

## Consequences

- A request for paging or sorting on a non-array, non-page result answers 400 after the method has run.
- An interceptor never sees a value a renderer turned into something other than its exact class.
- Interceptors and emission guards do not replace admission authorization; decide initial access in the guard stages.

## Related

- [Queries](index.md)
- [Observable queries](observable-queries.md)
