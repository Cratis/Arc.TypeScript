---
title: 'declared-field: Decorated field is erased'
description: Emit decorated class fields rather than declaring them away.
---

## What

A decorated property uses `declare`. Rule: `arc-core/declared-field`.

## Why

`declare` erases the property from the emitted class; use a definite assignment assertion when Arc initializes it.

## Bad

```ts
@field(String) declare title: string;
```

## Good

```ts
@field(String) title!: string;
```
