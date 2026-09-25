---
title: Defining an aggregate root
description: Write a Chronicle aggregate root in TypeScript, register event handlers by event class, keep replay free of side effects, and reject invalid changes.
---

An aggregate root holds the state one event source's history implies, and the methods that change it. You write the rules once, on the aggregate, and every command that changes an order goes through them.

## Define the events and the aggregate

```typescript title="Features/Order.ts"
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { AggregateRoot } from '@cratis/arc.chronicle';

@eventType('ItemAdded')
export class ItemAdded {
    @field(String) productId: string;
    @field(Number) quantity: number;

    constructor(productId: string, quantity: number) {
        this.productId = productId;
        this.quantity = quantity;
    }
}

export class OrderLimitExceeded extends Error {
    constructor() { super('The order total must not exceed 100'); }
}

export class Order extends AggregateRoot {
    quantity = 0;

    constructor() {
        super();
        this.on(ItemAdded, event => { this.quantity += event.quantity; });
    }

    canAdd(quantity: number): boolean {
        return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 100 - this.quantity;
    }

    addItem(productId: string, quantity: number): void {
        if (!this.canAdd(quantity)) throw new OrderLimitExceeded();
        this.apply(new ItemAdded(productId, quantity));
    }
}
```

`Order` keeps one piece of state, the total quantity. `canAdd` answers the rule against that state, `addItem` guards it, and `apply()` records the change. The explicit `'ItemAdded'` ID keeps the stored event type stable even if a bundler renames the class; without it, the SDK uses the class name.

## Register handlers by event class

`this.on(EventClass, handler)` registers the handler for one event type. The match is by class, not by method name, and each event type can have one handler; registering a second throws.

The handler runs in two situations:

- **Replay.** When the aggregate is loaded, Arc fetches the stored events of the handled types and passes each one in, rebuilt as an instance of its class.
- **Apply.** `apply(event)` runs the handler immediately, so the next rule in the same command already sees the new state.

Keep handlers to state changes. A handler that sends an email or calls a service does so again for every old event on every load.

The handler takes an optional second `EventContext` argument during replay, when you need the stored event's sequence number or occurred time. During `apply()` there is no context, so treat it as possibly `undefined`.

Arc loads only the event types the aggregate handles. An aggregate with no handlers can still apply events; it replays nothing.

## Reject a change

The aggregate has no failure list. A command rejects a change the usual Arc way: `handle()` asks the aggregate, and returns `rejected(...)` when the rule says no. The caller gets a 400 with your message, and nothing the aggregate applied is appended. [Injecting into commands](injecting-into-commands.md#reject-from-handle) shows the command.

The throw in `addItem` is a guard for a caller that skipped the question. It fails the command with an exception, which the caller sees as a 500, and nothing is appended either. Throw a class of your own, like `OrderLimitExceeded`, so the log names the domain problem.

For input you can check without history, such as a positive quantity, a [command validator](../../commands/command-validation.md) answers with a 400 before the aggregate is even loaded.

## Know what isNew means

The protected `isNew` property is `true` when the aggregate's route had no events at all when it loaded, including events it does not handle. Use it for "create once" rules:

```typescript
start(): void {
    if (!this.isNew) throw new Error('The order has already started');
    this.apply(new OrderStarted());
}
```

This method fragment assumes an `OrderStarted` event type registered with `this.on(...)` or appended without a handler.

## What it does not have

Arc on .NET's aggregate has `Failed(...)` for collecting rule failures, `OnActivate`, and a factory for loading an aggregate by an ID other than the command key. The TypeScript aggregate has none of these. Reject through a thrown error or Arc validation, and load one event source per command key.

Next, [inject the aggregate into a command](injecting-into-commands.md).
