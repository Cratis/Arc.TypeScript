---
title: Use low-level command and query definitions
description: Keep Zod-backed defineCommand and defineQuery definitions when decorators do not fit, on the same pipelines as model-bound artifacts.
---

Model-bound classes are the default. Keep `defineCommand` and `defineQuery` when you already have Zod schemas, need explicit `validate`/`filters`, or integrate code that cannot use decorators. The definitions run through the **same ArcServer pipelines** as model-bound artifacts.

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

This example registers two operations in memory; host `server` with [`runArc`](standalone-host.md) or an [HTTP adapter](host-integration.md) to serve `/api/tasks/create` and `/api/tasks/list`. A definition's Zod schema, not field decorators, controls its input and JSON Schema. Existing `serviceToken` registrations, outcome helpers, authorization descriptors, and client manifest exports continue to work. Do not mix both representations for the **same** operation: duplicate names or routes are rejected at startup.
