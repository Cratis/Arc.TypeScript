---
title: 'validator-target: Validator has no target'
description: Associate model-bound validators with their exact model.
---

## What

A class extends an Arc validator base but has no `@validator(Target)`. Rule: `arc-core/validator-target`.

## Why

Arc only discovers validators associated with an exact target class. The default rule expects `@validator(Target)`. With [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md), Arc reads the validator's generic target from source; configure the rule option `{ generatedMetadata: true }` for files compiled with that module.

## Bad

```ts
export class RegisterValidator extends CommandValidator<Register> {}
```

## Good

```ts
@validator(Register)
export class RegisterValidator extends CommandValidator<Register> {}
```

If your build generates and installs metadata, the undecorated form is also valid:

```js
{ 'arc-core/validator-target': ['error', { generatedMetadata: true }] }
```

Do not enable that option without the generation and stale-metadata build check: otherwise the class may never register.
