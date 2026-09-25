---
title: Causation and auditing
description: What the Chronicle integration records in the permanent causation chain for each command, which values it leaves out, and how @notAudited and @pii keep a secret or personal value out of it.
---

Six months from now someone asks why a purchase order exists. The event says what happened. Its **causation chain** says how it came about: which command produced it, and what that command was asked to do. The integration writes that record for you on every event a command returns.

The chain is stored with the event in the event log, and the event log is immutable. A value recorded there stays for as long as the event does, and every replay reads it. Changing your code later does not remove it. Decide what belongs in a permanent audit record before you add a field to a command.

## What is recorded

For this command:

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';

@eventType()
export class PurchaseOrderRaised {
    @field(String) supplier: string;
    @field(Number) amount: number;
    constructor(supplier = '', amount = 0) { this.supplier = supplier; this.amount = amount; }
}

@command()
export class RaisePurchaseOrder {
    @field(String) @key() orderId = '';
    @field(String) supplier = '';
    @field(Number) amount = 0;

    handle(): PurchaseOrderRaised { return new PurchaseOrderRaised(this.supplier, this.amount); }
}
```

a request with `{ "orderId": "po-26", "supplier": "ACME", "amount": 1234.56 }` adds an `Arc.Command` entry to the chain of the appended event:

| Property | Value |
| --- | --- |
| `Command` | `RaisePurchaseOrder` |
| `Value.orderId` | `po-26` |
| `Value.supplier` | `ACME` |
| `Value.amount` | `1234.56` |

The rules behind that table:

- The command's class name is always recorded, under `Command`.
- String, number, boolean, bigint, and [concept](../../concepts.md) values wrapping those primitives are recorded as `Value.<field>`, converted to a string and cut at 1,024 characters. Concepts wrapping `Guid` are recorded as the GUID string.
- Fundamentals `Guid`, `DateOnly`, `TimeOnly`, and `TimeSpan` values are recorded as strings; `Date` is recorded in UTC ISO-8601 form. Arrays and other nested objects are left out. Mark sensitive concepts `@pii()` or fields `@notAudited()`; their raw values must not be written to this permanent chain.
- The event also carries the correlation ID of the request and, as its identity, the signed-in principal, or Chronicle's system identity for an anonymous caller.

When commands run inside other commands, every event in the batch carries the chain of the outermost command; see [Transactional commands](transactional-commands.md#causation-in-a-batch). Commands a reactor returns get a `ReactorEvent` entry for the triggering event ahead of their own; see [Returning commands from a reactor](../reactors/command-side-effects.md).

## Keep a value out

Three things keep a field's value off the chain. The command is still named either way: an audit trail that hides which commands ran would not be an audit trail.

### Secrets: `@notAudited()`

```typescript
import { field } from '@cratis/fundamentals';
import { command, key } from '@cratis/arc.core';
import { notAudited } from '@cratis/arc.chronicle';

@command()
export class ConnectAccount {
    @field(String) @key() id = '';
    @field(String) @notAudited() confirmationCode = '';

    handle(): AccountConnected { return new AccountConnected(); }
}
```

This fragment assumes an `AccountConnected` event type. `@notAudited()` from `@cratis/arc.chronicle` withholds the field's value from the causation chain. It only withholds: it does not encrypt the value or enroll it in erasure. Apply it to a public instance field; with standard decorators, a static or private field throws when the class is defined.

### Personal data: `@pii`

The SDK's `@pii()` from `@cratis/chronicle/compliance` on a command field also keeps its value off the chain. On the command class itself, it withholds every value the command has. Marking the command does not mark the event you construct from it: annotate the event's own properties where the event stores personal data. See [Compliance](../compliance.md).

### Secret-looking names

A field whose name contains `password`, `secret`, `token`, `credential`, or `apiKey`, in any letter case, is never recorded, marked or not. The match is on part of the name, so `tokenCount` is skipped too. Do not rely on the name: a field called `value` that holds an API key is recorded. Mark it.

## Read the chain

In the [Chronicle Workbench](/chronicle/workbench/), open an event's context and then its causation entries. The `Arc.Command` entry lists the properties in the table above.

## Related

- [Returning events](index.md)
- [Event metadata](event-metadata.md)
- [Code analysis](../code-analysis.md), for why no TypeScript rule flags an unmarked secret
