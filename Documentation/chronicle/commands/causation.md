---
title: Causation and auditing
description: How the Chronicle integration records the command, its values, and the caller in the causation chain, and how @notAudited keeps secrets out of it.
---

Events are permanent, and so is the causation chain that says how each one came about. The integration records the command that produced an event, including its property values, so a reader later sees what the command was asked to do. That makes it important to keep secrets out.

## What is recorded

- The trusted Arc principal, the correlation ID, and the command's causation are scoped with the SDK's async `run` methods for the append.
- The command's name and field values are part of its causation.
- The SDK stamps one causation chain per batch; see [Transactional commands](transactional-commands.md#causation-in-a-batch).

## Keep a value out

```typescript
import { field } from '@cratis/fundamentals';
import { command, key } from '@cratis/arc.core';
import { notAudited } from '@cratis/arc.chronicle';

@command()
export class ConnectAccount {
    @field(String) @key() id = '';
    @field(String) @notAudited() apiToken = '';
    handle() { /* return an event that does not contain the token */ }
}
```

`@notAudited()` excludes the field's value from the permanent causation chain. Arc also excludes fields the SDK marks `@pii` and obviously secret-named fields. `@notAudited()` only withholds the value; unlike `@pii`, it does not encrypt it or enroll it in erasure.

## Related

- [Returning events](index.md)
- [Glossary: causation chain](/arc/glossary/)
