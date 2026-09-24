---
title: 'missing-field: Property is not bound'
description: Mark every model-bound property with @field.
---

## What

A non-`declare` public instance property on `@command()` or `@readModel()` lacks `@field`. Rule: `arc-core/missing-field`.

## Why

Unmarked properties are invisible to Arc's wire schema. Private-like `_` names are intentionally ignored.

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
