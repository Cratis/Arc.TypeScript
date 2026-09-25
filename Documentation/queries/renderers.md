---
title: Render provider-backed queries
description: Register a scoped result renderer before read-model interception and ordinary paging.
---

Your data provider can count and page a result itself, and your query method returns the provider's query object, not an array. Arc's in-memory paging cannot work with that value, and loading every row just to page it defeats the point. A `QueryRenderer` takes the provider-owned value and returns the page the provider cut, with its authoritative total.

## Write a renderer

Implement `QueryRenderer` and mark the class with `@queryRenderer()`:

```ts
import { ArcApplication, queryPage, queryRenderer, type QueryRenderer } from '@cratis/arc.core';

class PendingItems { /* Provider-specific query, not a result array. */ }
@queryRenderer()
class PendingItemsRenderer implements QueryRenderer {
    canRender(value: unknown): boolean { return value instanceof PendingItems; }
    render(value: unknown) {
        if (!(value instanceof PendingItems)) throw new Error('Unexpected query');
        // Replace this example with your provider's count and page operation.
        return queryPage([{ id: 1 }], 1);
    }
}

const builder = ArcApplication.createBuilder();
builder.add(PendingItemsRenderer); // Or register a service and call addQueryRenderer(token).
```

`render` receives the value, the request's `ExecutionContext`, and its `QueryOptions`. It returns data, or `queryPage(items, totalItems, sorting)` with the provider's authoritative count and the sort it confirmed. Arc does not re-sort or re-page a `queryPage` in memory.

## Register it

- `@queryRenderer()` lets `builder.add()` or `builder.discover()` register the class as a scoped service.
- Without the decorator, register a service token with `builder.services.addScoped()` and pass it to `builder.addQueryRenderer()`.
- With the lower-level `ArcServer`, list the tokens in `ArcOptions.queryRenderers`, and interceptor tokens in `readModelInterceptors`.

Arc asks renderers in registration order, and **only the first** whose `canRender` accepts the value runs. With no matching renderer, Arc's existing behavior for arrays, `queryPage` results, and scalars applies.

## How it runs

The renderer and the [read-model interceptors](read-model-interception.md) after it resolve in the same request or subscription scope. They also run for each observable emission, including a current-value snapshot. The [query pipeline](query-pipeline.md#result-stages) shows where renderers run relative to interceptors, paging, and emission guards.

A renderer does **not** automatically push SQL or MongoDB sorting and paging into a provider. It must own those operations, and the authoritative total, itself.

## Next steps

- [Paging and sorting](model-bound/paging.md) covers the request parameters a renderer reads from `QueryOptions`.
- [Intercept read models](read-model-interception.md) transforms the items a renderer returns.
