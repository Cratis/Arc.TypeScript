---
title: 'validator-target: Validator has no target'
description: Associate model-bound validators with their exact model.
---

## What

A class extends an Arc validator base but has no `@validator(Target)`. Rule: `arc-core/validator-target`.

## Why

Arc only discovers validators associated with an exact target class.

## Bad

```ts
export class RegisterValidator extends CommandValidator<Register> {}
```

## Good

```ts
@validator(Register)
export class RegisterValidator extends CommandValidator<Register> {}
```
