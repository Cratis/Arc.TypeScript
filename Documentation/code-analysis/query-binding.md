---
title: 'query-binding: Descriptor disagrees with parameter'
description: Keep explicit query descriptors in positional sync.
---

## What

The number of `@query` descriptors differs from the runtime method parameter count, or a provable constructor token type disagrees with its parameter. Rule: `arc-core/query-binding`. Count checks work without a TypeScript program; type comparisons need one.

## Why

Arc binds explicit query arguments and services in declaration order and counts parameters using `method.length` (before the first default or rest parameter). Argument wire names need not match TypeScript parameter names. Bare `@query()` uses inferred metadata and is not checked by this rule.

## Bad

```ts
@query(argument('id', TaskId), argument('limit', Number))
static byId(id: TaskId, limit = 10) { return tasks.byId(id); }
```

## Good

```ts
@query(argument('taskId', TaskId))
static byId(id: TaskId) { return tasks.byId(id); }
```
