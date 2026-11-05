---
title: 'unexported-artifact: Discovery cannot see a class'
description: Resolve Arc TypeScript unexported-artifact diagnostics by exporting decorated commands, read models and validators for file-based artifact discovery.
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
