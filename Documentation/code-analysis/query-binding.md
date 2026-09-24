---
title: 'query-binding: Descriptor disagrees with parameter'
description: Keep explicit query descriptors in positional sync.
---

## What

The count, literal argument name, or provable constructor token type of `@query` descriptors disagrees with the method signature. Rule: `arc-core/query-binding` (requires type information).

## Why

Arc binds explicit query arguments and services in declaration order. Bare `@query()` uses inferred metadata and is not checked by this rule.

## Bad

```ts
@query(argument('wrongName', TaskId))
static byId(id: TaskId) { return tasks.byId(id); }
```

## Good

```ts
@query(argument('id', TaskId))
static byId(id: TaskId) { return tasks.byId(id); }
```
