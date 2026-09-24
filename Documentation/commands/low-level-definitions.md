---
title: Low-level definitions
description: Keep Zod-backed defineCommand, defineQuery, and defineObservableQuery definitions when decorators do not fit, on the same pipelines as model-bound artifacts.
---

Model-bound classes are the default. Keep `defineCommand`, `defineQuery`, and `defineObservableQuery` when you already have Zod schemas, need explicit `validate` and `filters` callbacks, or integrate code that cannot use decorators. The definitions run through the **same pipelines** as model-bound artifacts.

```typescript
import { ArcServer, defineCommand, defineQuery } from '@cratis/arc.core';
import { z } from 'zod';

const tasks = new Map<string, string>();
const create = defineCommand({
    name: 'Create', namespace: 'Tasks', schema: z.object({ id: z.string(), title: z.string() }),
    handle: ({ id, title }) => { tasks.set(id, title); return id; }
});
const list = defineQuery({
    name: 'List', namespace: 'Tasks', schema: z.object({}),
    perform: () => [...tasks].map(([id, title]) => ({ id, title }))
});
const server = new ArcServer({ commands: [create], queries: [list] });
```

This registers two operations in memory. Host `server` with [`runArc`](../core/index.md#host-a-low-level-server) or a [host adapter](../hosts/index.md) to serve `POST /api/tasks/create` and `GET /api/tasks/list`. You can also pass the definitions to `ArcApplication.createBuilder({ commands: [create], queries: [list] })` next to model-bound artifacts.

## What differs from model-bound artifacts

- The Zod schema, not field decorators, controls the input and its JSON Schema. Schemas must convert to JSON Schema; see [Command filters](command-filters.md#keep-the-schema-for-shape).
- Services are declared with `handlerDependencies` and `validatorDependencies` and resolved with `currentServices()`; see [Dependency injection](../dependency-injection.md#low-level-services).
- Validation uses `validate` and `filters`; see [Command filters](command-filters.md).
- Commands can declare [execution scopes](command-execution-scopes.md).
- Authorization is a property: `authorization: { roles: ['editor'] }`, plus an optional per-request `authorize(input, context)`; see [Authorizing commands and queries](../authorizing-commands-and-queries.md).
- Client generation uses an explicit `clientOutput` contract and the [low-level manifest](../proxy-generation/low-level-manifest.md).

Do not mix both representations for the **same** operation: duplicate names or routes are rejected at startup. The full list of definition fields is in [Configuration](../configuration/index.md#low-level-definition-fields).

## Related

- [Query arguments](../queries/model-bound/query-arguments.md), which apply to both kinds of query
- [Observable queries](../queries/observable-queries.md) for `defineObservableQuery`
