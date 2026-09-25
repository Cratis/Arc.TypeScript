---
title: Test Chronicle commands against a kernel
description: Seed an event source's history, run Arc commands against a live Chronicle kernel, and assert aggregates, projections, constraints, and concurrency in an isolated event store.
---

Some command behavior only exists in the kernel. An aggregate needs stored history to load, a projection needs the kernel to run it, and a constraint or concurrency check is enforced when Chronicle appends. The [in-memory scenario](chronicle.md) does none of that. `ChronicleKernelScenario` from `@cratis/arc.chronicle/testing` runs the command through the real Arc pipeline against a running kernel, in a fresh event store for each scenario.

:::caution[Experimental]
The Chronicle integration and its testing helpers are experimental. A kernel scenario needs a running Chronicle kernel, so it is **not** part of `yarn test` or the default `yarn ci` check.
:::

## Point the scenario at a kernel

A scenario connects to the connection string in `ARC_CHRONICLE_TEST_URL`, or to the `connectionString` option you pass to `for(...)`. Without either, `for(...)` throws `ARC_CHRONICLE_TEST_URL is required for a kernel scenario`. It never starts a kernel itself.

In your own application, start a development kernel as [Add event sourcing](../chronicle/add-event-sourcing.md#start-a-development-kernel) shows, and run your specs with `ARC_CHRONICLE_TEST_URL=chronicle://localhost:35000`.

In this repository, one command starts a kernel and runs the Library sample's kernel suite:

```shell
yarn workspace @cratis/arc.sample.library test:kernel
```

The script starts `cratis/chronicle:latest-development` on a free loopback port with a unique container name, then stops and removes **only that container** on exit. To use a kernel that is already running, set `ARC_CHRONICLE_TEST_URL` to its `chronicle://host:port` connection string; the script then leaves that kernel running. A missing Docker service or an unreachable kernel fails the check instead of skipping it.

For `bash Source/Chronicle/run-integration.sh` against a kernel that is already running, also set `ARC_CHRONICLE_TEST_MONGO_URL` to its MongoDB connection string, for example `mongodb://localhost:27017/?directConnection=true`. That suite checks ciphertext in raw storage and fails early without the URL.

## Seed an event source's history

When a decision depends on stored history, seed it with `given.events(...)`. An aggregate is the usual case. This slice returns a book. The `Loan` aggregate replays the book's loans, and `handle()` rejects the return of a book that is not lent. `BookLent` comes from the lending slice on [Testing Chronicle commands](chronicle.md#the-slice-under-test):

```typescript title="Features/Books/Returning/Returning.ts"
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, inject, key, rejected, validation } from '@cratis/arc.core';
import { AggregateRoot, commandAggregate } from '@cratis/arc.chronicle';
import { BookId } from '../BookId.js';
import { BookLent } from '../Lending/Lending.js';

@eventType()
export class BookReturned {
    @field(String) member: string;
    constructor(member = '') { this.member = member; }
}

export class BookIsNotLent extends Error {
    constructor() { super('The book is not lent'); }
}

export class Loan extends AggregateRoot {
    borrower: string | null = null;

    constructor() {
        super();
        this.on(BookLent, event => { this.borrower = event.member; });
        this.on(BookReturned, () => { this.borrower = null; });
    }

    returnBook(): void {
        if (this.borrower === null) throw new BookIsNotLent();
        this.apply(new BookReturned(this.borrower));
    }
}

@command()
export class ReturnBook {
    @key() @field(BookId) bookId!: BookId;

    @inject(commandAggregate(Loan))
    handle(loan: Loan) {
        if (loan.borrower === null) return rejected(validation('The book is not lent'));
        loan.returnBook();
    }
}
```

The test seeds a `BookLent` for the book, returns it, and then tries again:

```typescript title="Features/Books/Returning/for_ReturnBook/when_returning/with_a_lent_book.ts"
import { describe, it } from 'vitest';
import { ChronicleKernelScenario } from '@cratis/arc.chronicle/testing';
import { BookId } from '../../../BookId.js';
import { BookTitle } from '../../../BookTitle.js';
import { BookLent } from '../../../Lending/Lending.js';
import { BookReturned, ReturnBook } from '../../Returning.js';

const withKernel = process.env.ARC_CHRONICLE_TEST_URL ? describe : describe.skip;

withKernel('when returning a lent book', () => {
    it('should append the return for the member who borrowed it', { timeout: 60_000 }, async () => {
        const scenario = ChronicleKernelScenario.for(ReturnBook, [BookLent, BookReturned]);
        try {
            const bookId = BookId.create();
            await scenario.given.events({ eventSourceId: bookId.toString(), event: new BookLent(new BookTitle('Kindred'), 'member-1') });

            const returned = await scenario.execute({ bookId });
            returned.shouldBeSuccessful();
            returned.shouldHaveAppendedEvent(BookReturned, bookId.toString(), event => event.member === 'member-1');

            const again = await scenario.execute({ bookId });
            again.shouldNotBeSuccessful();
            again.shouldHaveValidationErrorFor('The book is not lent');
            again.appendedEvents.should.have.lengthOf(0);
        } finally {
            await scenario.dispose();
        }
    });
});
```

How the pieces work:

- `for(Command, artifacts)` takes the artifacts as an **array**, unlike the in-memory scenario. Register every event type the test seeds or the command appends. The aggregate class is not registered.
- `given.events(...)` appends the seeded events, each as `{ eventSourceId, event }`, and waits for the kernel's observers before it returns. Seed the event source that the command key names; the aggregate loads that source.
- `result.appendedEvents` holds only the events this execution appended, never the seeded ones.
- A failed `given.events(...)` throws, so a broken seed fails the test instead of passing silently.
- The `{ timeout: 60_000 }` option gives the kernel time. The first execution against a fresh event store can take several seconds, longer than the Vitest default of five seconds.
- Without `ARC_CHRONICLE_TEST_URL`, the suite is skipped, so `yarn test` stays kernel-free.

The second `execute` replays both the seeded `BookLent` and the `BookReturned` the first one appended, so the aggregate has no borrower, and `handle()` answers with a validation result. `returnBook()` also throws `BookIsNotLent` as a guard for a caller that skips the check; see [Reject a change](../chronicle/aggregates/defining-an-aggregate-root.md#reject-a-change).

## Assert a projection

Seeding also drives projections. Register the read model with the scenario, and assert it with `shouldHaveReadModel(Type, id, predicate?)`. The [Library suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/kernel-scenarios.test.mjs) seeds a `BookAdded`, checks the `Book` read model it projects, executes `AddBook`, and checks the new book:

```typescript
const scenario = ChronicleKernelScenario.for(AddBook, [BookAdded, Book, AddBookValidator, BookTitleValidator]);
try {
    const seededId = BookId.create();
    await scenario.given.events({ eventSourceId: seededId.toString(), event: new BookAdded(authorId, title) });
    await scenario.shouldHaveReadModel(Book, seededId.toString());
    const result = await scenario.execute({ bookId, authorId, title });
    result.shouldBeSuccessful();
    result.shouldHaveAppendedEvent(BookAdded, bookId.toString());
    await scenario.shouldHaveReadModel(Book, bookId.toString());
} finally {
    await scenario.dispose();
}
```

This is an excerpt; `AddBook`, `BookAdded`, `Book`, and the value types come from the Library sample. `shouldHaveReadModel` reads the kernel's read model once and does not poll. It can rely on the read model being current because `given.events(...)` and `execute(...)` wait for the kernel's observers before they return.

That wait covers the observers that processed the append, **or failed** on it. A timeout or a failed observer fails the scenario, instead of claiming that the read model is ready. The wait is not a transaction across observers and side effects, and a later replay can still change the model. A scenario cannot recover a failed observer by sleeping; diagnose it in Chronicle instead.

## Assert a constraint or concurrency rejection

A command whose append Chronicle rejects is not successful, and nothing is appended. Assert it with `result.shouldNotBeSuccessful()`, and read the reason from `result.validationResults`: `constraintViolation` for a [constraint](/chronicle/constraints/), `concurrencyViolation` for a [concurrency scope](../chronicle/commands/concurrency.md). The Library suite registers the `UniqueAuthorName` constraint, executes `RegisterAuthor` twice with the same name, and expects `constraintViolation` on the second.

Set trusted request values, such as a librarian principal, on `scenario.context`, as the in-memory scenario does.

## Register only the observers the scenario needs

After every append, the scenario waits until **every** observer registered in its event store has processed the append tail. Chronicle currently includes observers that do not handle the appended event type, and such an observer never reaches that tail. The wait then runs for the full `timeoutMs` and fails, although the events were appended and the relevant projections ran. This is [Cratis/Chronicle#4132](https://github.com/Cratis/Chronicle/issues/4132).

A projection or reactor you register in a scenario must therefore handle every event type the scenario seeds or appends. The `Book` projection in the example above handles `BookAdded`, the only event that scenario appends. If a test also needs events the projection ignores, for example seeding `BookAdded` and then executing `LendBook`, which appends `BookLent`, split it: one scenario registers `Book` and checks the projection, another leaves `Book` out and checks the loan.

The same limitation applies to an application that sets `completionTimeoutMs`; see [Add event sourcing](../chronicle/add-event-sourcing.md#make-the-command-wait).

## Scenario members

| Member | Meaning |
| --- | --- |
| `for(Command, artifacts, { connectionString?, timeoutMs? })` | Create the scenario against a fresh event store. `connectionString` defaults to `ARC_CHRONICLE_TEST_URL`, and the observer wait `timeoutMs` to 10000 |
| `context` | Trusted request values, such as the principal |
| `given.events(...events)` | Append seed events, each as `{ eventSourceId, event }`, and wait for the observers |
| `execute(values)` | Run the command and wait for the observers; the result has the usual [command assertions](commands.md#assertions) |
| `result.appendedEvents` | The events this execution appended |
| `result.shouldHaveAppendedEvent(Type, sourceId?, predicate?)` | An event of that type was appended in this execution, optionally to a source and matching a predicate |
| `shouldHaveReadModel(Type, id, predicate?)` | The kernel holds a matching read model; returns it |
| `store()` | The scenario's SDK event store, for reads the helpers do not cover |
| `eventStoreName` | The name of the scenario's event store |
| `dispose()` | Release the scenario and its SDK client; call it after every test |

Each scenario creates a new event store with a random name and uses the `Default` namespace. `dispose()` does not delete the event store from the kernel; a development kernel loses it when you remove the container.

## Related

- [Testing Chronicle commands](chronicle.md)
- [Aggregates](../chronicle/aggregates/index.md)
- [Choose Chronicle read consistency](../queries/read-consistency.md)
