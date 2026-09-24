---
title: Render provider-backed queries
description: Register a scoped result renderer before read-model interception and ordinary paging.
---
<!-- Copyright (c) Cratis. All rights reserved.
Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Use `QueryRenderer` when a query returns a provider-owned value instead of an
array. Mark a class with `@queryRenderer()` so `builder.add()` or
`builder.discover()` registers it as scoped, or explicitly register a service
token with `builder.services.addScoped()` and `addQueryRenderer()`. Arc asks
renderers in registration order;
**only the first** whose `canRender` accepts the value runs. It receives the
request's `QueryOptions` and `ExecutionContext` and returns data or
`queryPage(items, totalItems, sorting)` with the provider's authoritative
count and confirmed sort. A `queryPage` is not re-sorted or paged in memory.

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

The renderer and subsequent [read-model interceptors](read-model-interception.md)
resolve in the same request/subscription scope. They also run for each
observable emission, including a current-value snapshot. Register tokens in
`ArcServerOptions.queryRenderers` and `readModelInterceptors` when using the
lower-level `ArcServer` directly. With no matching renderer, Arc's existing
array/`queryPage`/scalar behavior applies. This does **not** automatically
push SQL or MongoDB sorting and paging into a provider: the renderer must own
those operations and the authoritative total itself.
