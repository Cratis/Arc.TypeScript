---
title: Subject
description: Tell Chronicle whose personal data the events of a command carry, with getSubject(), a @subject() field, @eventSubject, or a routed event, and know the resolution order.
---

An order belongs to the order's event source, but the email address on it belongs to a customer. When that customer asks to be forgotten, Chronicle must find every event carrying their data, across every order. The **subject** is how it finds them: Chronicle records a compliance subject on each event, and keys personal-data handling to it.

By default the subject is the event source ID, which is right when the entity is the person. Set it on the command when the data belongs to someone else.

## Compute it on the command

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';

@eventType()
export class OrderPlaced {
    @field(String) customerId: string;
    @field(Number) amount: number;
    constructor(customerId = '', amount = 0) { this.customerId = customerId; this.amount = amount; }
}

@command()
export class PlaceOrder {
    @field(String) @key() orderId = '';
    @field(String) customerId = '';
    @field(Number) amount = 0;

    getSubject(): string { return this.customerId; }

    handle(): OrderPlaced { return new OrderPlaced(this.customerId, this.amount); }
}
```

`OrderPlaced` is appended to the order, and its subject is the customer. `getSubject()` runs after `handle()`, when the returned events are prepared, so it can read any field. Return a string.

## Mark a field

When a field already holds the subject, mark it with the SDK's `@subject()` from `@cratis/chronicle/compliance`:

```typescript
import { field } from '@cratis/fundamentals';
import { subject } from '@cratis/chronicle/compliance';
import { command, key } from '@cratis/arc.core';

@command()
export class RegisterCustomer {
    @field(String) @key() customerId = '';
    @field(String) @subject() personId = '';
    @field(String) email = '';

    handle(): CustomerRegistered { return new CustomerRegistered(this.email); }
}
```

This command fragment assumes a `CustomerRegistered` event type in your application.

:::caution[A GUID-valued subject field is ignored]
Arc reads a `@subject()` field only when its value is a string or a concept that wraps a string. A field holding a Fundamentals `Guid`, or a concept wrapping one, is skipped without an error, and the subject falls through to the next source. Declare the field as a string, or implement `getSubject()` and return `this.personId.toString()`.
:::

## Set a fixed subject

`@eventSubject('subject')` from `@cratis/arc.chronicle` sets the same subject for every event the command returns. It suits a subject that does not vary per request, such as a system actor.

## Resolution order

For each event a command returns, the integration takes the first of:

1. the `subject` on an [`eventForEventSourceId`](event-metadata.md#override-one-event) entry;
2. `getSubject()` on the command;
3. a `@subject()` field holding a string or string concept;
4. `@eventSubject(...)` on the command;
5. the event's event source ID.

Events an [aggregate](../aggregates/index.md) applies go through the same order, because the command's batch prepares them the same way.

The subject never comes from the signed-in user. Authentication tells you who made the request; the subject says whose data the event holds, and the two often differ.

## What the subject does not do

Setting a subject does not mark anything as personal data. Values are marked with the SDK's `@pii` decorator, and Chronicle's compliance handling keys them to the subject; the [Chronicle compliance](/chronicle/compliance/) documentation covers that side. Arc does not release encrypted values when it serves a read model. See [Compliance](../compliance.md) for what the integration does and does not handle.

## Related

- [Event metadata](event-metadata.md)
- [Compliance](../compliance.md)
- [Chronicle compliance](/chronicle/compliance/)
