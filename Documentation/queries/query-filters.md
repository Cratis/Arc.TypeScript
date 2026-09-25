---
title: Query filters
description: Admit every query before validation with scoped authorization filters, or reject a query with ordinary pipeline filters.
---

Global query filters run for snapshot GET and `QUERY` requests and at admission for observable subscriptions
(direct SSE, WebSocket, and multiplexed hubs), including the opt-in authenticated `QueryHealth.ObserveHealth` operation. They do **not** run for every emission. Use an
[emission guard](observable-query-emission-guards.md) if access needs to be checked throughout a live subscription.

`AuthorizationQueryFilter` runs first, before validator or performer dependencies are constructed.
`QueryPipelineFilter` runs next, before validation and the performer. Both expose `onPerform(context: QueryContext)`,
which may return a `QueryResult` fragment or nothing. The context carries the bound `query` arguments, request identity,
query `options`, and an `operationName` equal to the namespace-qualified declaration identity shown in introspection. Framework-created contexts make this name non-writable and non-configurable; manually built contexts may omit it. A filter gating on the name must deny absent identity or explicitly handle a manual context, never infer identity from query payload. When schema parsing fails, authorization filters see raw input and ordinary filters do not run.
Transport argument coercion errors are rejected before the filter pipeline.
A denial answers 403 with no data or validation results. Query denials have no reason field.

```typescript title="query-gates.ts"
import { ArcApplication, authorizationQueryFilter, queryPipelineFilter, queryFilterResult,
    unauthorizedQueryResult, validation, type AuthorizationQueryFilter, type QueryPipelineFilter,
    type QueryContext, type QueryResult } from '@cratis/arc.core';

@authorizationQueryFilter()
class TenantGate implements AuthorizationQueryFilter {
    onPerform(context: QueryContext): QueryResult | void {
        if (!context.tenantId) return unauthorizedQueryResult(context);
    }
}

@queryPipelineFilter()
class QueryGate implements QueryPipelineFilter {
    onPerform(context: QueryContext): QueryResult | void {
        if (typeof context.query === 'object' && context.query !== null &&
            'value' in context.query && context.query.value === '') {
            return queryFilterResult(context, { validationResults: [validation('Value is required', ['value'])] });
        }
    }
}

export const builder = ArcApplication.createBuilder();
builder.add(TenantGate, QueryGate);
```

You can also register tokens using `ArcOptions.authorizationQueryFilters` and `.queryPipelineFilters`, or
`builder.addAuthorizationQueryFilter(token)` and `.addQueryPipelineFilter(token)`. Register explicit tokens as scoped
or transient services. Within each group the order is ArcOptions tokens, then explicit builder calls, then decorated
classes in `add()` order. A token registered more than once runs once; a token in both groups fails at build.
An unsuccessful fragment stops that group and skips subsequent stages. Invalid fragments and thrown filters fail closed
with 500. Omitted fragment fields retain their defaults; supplied authorization and readiness must be boolean, and validation severity must be a `Severity` value. The existing per-definition `QueryFilter<T>` callbacks remain separate and collect validation results
at the validator stage. If cancellation occurs while a filter, validator dependency or callback, or performer dependency is pending, Arc waits for it to settle, fails the request without starting later stages or the snapshot/observable query producer, and releases its operation scope. Already-running callbacks are not interrupted.

The admission-filter specs exercise in-process observable hub admission and direct SSE for health. The .NET conformance fixture exercises query GET, `QUERY`, observable snapshots, and direct SSE on Express; it does not exercise query-filter denial through Fastify, Hono, or direct WebSocket transports. See [Query pipeline](query-pipeline.md) for the complete order and [Authorizing commands and queries](../authorizing-commands-and-queries.md) for declared authorization.
