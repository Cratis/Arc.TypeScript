---
title: 'inject-binding: Injection token disagrees with handler'
description: Match typed handle parameters to injected services.
---

## What

The count or provable constructor instance type of a class-valued `@inject` token disagrees with `handle` parameters. Rule: `arc-core/inject-binding` (requires type information).

## Why

Arc binds positional tokens. One extra leading handler parameter can consume an implicit `provide()` value; other mismatches cause a runtime dependency error. Opaque tokens are left to the runtime.

## Bad

```ts
@inject(OtherService)
handle(tasks: Tasks) {}
```

## Good

```ts
@inject(Tasks)
handle(tasks: Tasks) {}
```
