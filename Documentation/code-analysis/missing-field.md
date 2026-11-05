---
title: 'missing-field: Property is not bound'
description: Resolve the Arc TypeScript missing-field lint rule by marking public command and read-model properties with @field so they appear in wire schemas.
---

## What

A non-`declare` public instance property on `@command()` or `@readModel()` lacks `@field`. Rule: `arc-core/missing-field`.

## Why

Unmarked properties are invisible to Arc's wire schema. Private fields (`private` and `#`) and private-like `_` names are intentionally ignored.

## Bad

```ts
@command()
export class Register { title!: string; handle() {} }
```

## Good

```ts
@command()
export class Register { @field(String) title!: string; handle() {} }
```
