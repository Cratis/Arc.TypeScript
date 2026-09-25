---
title: Read models in commands
description: Take the Chronicle read model projected for a command's key as a handle() or provide() parameter with commandReadModel, read it in a validator with readModelForValidation, and decide what a missing instance means.
---

A member reserves a book. The reservation event should carry the book's title, and the command should refuse a book that is not in the catalog. Both answers are already in the `Book` read model Chronicle keeps for that book. You should not need to write a query, call it from the command, and map "not found" to an error yourself.

Arc loads the read model whose ID is the command's key and passes it in. There are three places to take it:

| Position | Use it when | Declare it with |
| --- | --- | --- |
| `handle()` | The event you return is computed from the state | `@inject(commandReadModel(Book))` |
| `provide()` | The state is combined with other fetched data before `handle()` decides | `@inject(commandReadModel(Book))` |
| A command validator | The command should be rejected with your own message | `await readModelForValidation(Book, { optional: true })` in an async rule |

All three read the same instance: Arc loads each read model type at most once per command execution.

## Take it in handle()

```typescript title="Reservation.ts"
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { command, commandReadModel, inject, key } from '@cratis/arc.core';

@eventType()
export class BookAdded {
    @field(String) title: string;
    constructor(title = '') { this.title = title; }
}

@eventType()
export class BookReserved {
    @field(String) title: string;
    @field(String) member: string;
    constructor(title = '', member = '') { this.title = title; this.member = member; }
}

@fromEvent(BookAdded)
export class Book {
    @field(String) id = '';
    @field(String) title = '';
}

@command()
export class ReserveBook {
    @field(String) @key() bookId = '';
    @field(String) member = '';

    @inject(commandReadModel(Book))
    handle(book: Book): BookReserved {
        return new BookReserved(book.title, this.member);
    }
}
```

Register the command, the events, and `Book` with `builder.add(...)` after `withChronicle`, or use `builder.discover(...)` before or after it. `ReserveBook` for a book in the catalog appends `BookReserved` with the book's title. For a book that is not, it answers 400 with `Book was not found for the command key`, and `handle()` never runs.

`Book` is a Chronicle read model because `@fromEvent` projects it. Add Arc's `@readModel()` and queries when clients should read it too; see [Chronicle read models](index.md).

## Take it in provide()

`provide()` receives the read model the same way, and its return value becomes the first `handle()` argument:

```typescript
@inject(commandReadModel(Book))
provide(book: Book): string { return book.title.trim(); }

handle(title: string): BookReserved { return new BookReserved(title, this.member); }
```

This fragment replaces the `handle()` method of `ReserveBook`. Use `provide()` when the state has to be combined with something else you fetch, such as a rate or a policy, before `handle()` decides. See [Model-bound commands](../../commands/model-bound/index.md#prepare-data-in-provide).

## Read it in a validator

Validators do not take read models as constructor parameters. Call `readModelForValidation` inside an asynchronous rule instead:

```typescript
import { CommandValidator, readModelForValidation, validator } from '@cratis/arc.core';
import { Book, ReserveBook } from './Reservation.js';

@validator(ReserveBook)
export class ReserveBookValidator extends CommandValidator<ReserveBook> {
    constructor() {
        super();
        this.ruleFor(command => command.bookId)
            .mustAsync(async () => await readModelForValidation(Book, { optional: true }) !== null)
            .withMessage('The book is not in the catalog');
    }
}
```

`readModelForValidation` uses the command's key and the caller's tenant; it takes no ID, so a rule cannot read another entity by accident. It works only in validators of model-bound commands, while they run. Pass `{ optional: true }` and write the rule around `null`. Without it, a missing model throws inside the rule, and Arc reports a failed validator (reason `validatorFailed`) instead of your message.

## Required or optional

The key tells Arc which instance to load. It does not prove that instance exists. Say what absence means:

| Declaration | Missing instance |
| --- | --- |
| `commandReadModel(Book)` | The command is rejected with 400 before your code runs |
| `commandReadModel(Book, { optional: true })` | Your code receives `null` |

Choose optional when absence is a state your rule handles, such as "register only if not registered yet". Keep it required when the command cannot mean anything without the state. A read model that was projected asynchronously can lag behind the event that created it, so a command sent straight after creation can find nothing yet. For a rule that must hold regardless, use a Chronicle constraint. [When read model resolution fails](failures.md) lists every failure.

## Which read models qualify

- Chronicle resolves a type only when it is a read model in the application's Chronicle catalog: projected with `@fromEvent` or other model-bound projection decorators, or targeted by a projection or reducer, and registered through `discover()` (in either order) or `add()` after `withChronicle`.
- A MongoDB read model listed in `withMongoDB({ readModels })` is loaded the same way, from its collection; see [MongoDB](../../mongodb/index.md). Exactly one integration may own a type: `build()` fails when none or two claim it.
- The Drizzle integration does not resolve command read models.

## Combine it with an aggregate

A command can take both: projected state as context, and an [aggregate](../aggregates/injecting-into-commands.md) as the thing that changes. List both in `@inject(...)`, in the order of the `handle()` parameters. The read model is a snapshot; it does not lock anything, and it can lag. The aggregate's revision is what protects the decision.

## Test it

`ChronicleCommandScenario.givenReadModel(Book, 'book-1', instance)` pins the instance `commandReadModel(Book)` receives. See [Testing Chronicle commands](../../testing/chronicle.md).

## Related

- [When read model resolution fails](failures.md)
- [Load a read model by key](../../commands/command-context.md#load-a-read-model-by-key)
- [Command validation](../../commands/command-validation.md)
