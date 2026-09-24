---
title: 'misplaced-decorator: Decorator has no effect'
description: Put query, injection, and authorization decorators on supported declarations.
---

## What

`@query` is not on a static read-model method, `@inject` is not on a command `handle`, or authorization is placed on an unsupported member. Rule: `arc-core/misplaced-decorator`.

## Why

Arc does not compile these declarations into an endpoint or injection binding.

## Bad

```ts
export class TaskItem { @query() static all() { return []; } }
```

## Good

```ts
@readModel()
export class TaskItem { @query() static all() { return []; } }
```
