---
title: 'unexported-artifact: Discovery cannot see a class'
description: Export commands, read models, and validators.
---

## What

A decorated Arc artifact is not exported, including an export at the end of the file. Rule: `arc-core/unexported-artifact`.

## Why

File-based discovery inspects exported declarations, not file-local classes.

## Bad

```ts
@command()
class Register { handle() {} }
```

## Good

```ts
@command()
export class Register { handle() {} }
```
