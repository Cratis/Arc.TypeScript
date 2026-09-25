---
title: Testing Chronicle commands
description: Test event-sourced Arc commands - assert the events a command appends, pin the read models it reads, seed an event source's history, and choose between the in-memory and kernel-backed scenarios.
---

An event-sourced command makes a decision and records it as events. A test for it answers three questions: what state did the command see, which events did it append, and what did it refuse. `@cratis/arc.chronicle/testing` has two scenarios for this. Both run the command through the real Arc pipeline: authorization, validation, `provide()`, `handle()`, and the Chronicle response handler.

:::caution[Experimental]
The Chronicle integration and its testing helpers are experimental. See [Chronicle](../chronicle/index.md) for their status.
:::

## Choose a scenario

| | `ChronicleCommandScenario` | `ChronicleKernelScenario` |
| --- | --- | --- |
| Needs | Nothing; the event log is in memory | A running Chronicle kernel at `ARC_CHRONICLE_TEST_URL` |
| Runs in `yarn test` | Yes | Only when you opt in |
| State the command reads | Read models you pin with `givenReadModel` | Events you seed with `given.events`, projected by the kernel |
| Aggregates (`commandAggregate`) | Not supported; the command fails | Rehydrated from the seeded events |
| Constraints and concurrency | Not enforced | Enforced |
| Projections | Not run | Run; assert them with `shouldHaveReadModel` |

Start with `ChronicleCommandScenario`. Most tests check the decision a command makes from the state it is given, and the in-memory scenario checks that in milliseconds. Move to `ChronicleKernelScenario` when the test depends on stored history, an aggregate, a projection, a constraint, or a concurrency check.

## The slice under test

The examples on this page test a lending slice built on the [Library sample](https://github.com/Cratis/Arc.TypeScript/tree/main/Samples/Library). The slice is written for this page and is not part of the sample. It uses the sample's `Book` read model, which a projection builds from `BookAdded`, and its `BookId` and `BookTitle` concepts. One file holds the command, its validator, and its events:

```typescript title="Features/Books/Lending/Lending.ts"
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, commandReadModel, CommandValidator, inject, key, validator } from '@cratis/arc.core';
import { BookId } from '../BookId.js';
import { BookTitle } from '../BookTitle.js';
import { Book } from '../Listing/Listing.js';

@eventType()
export class BookLent {
    @field(BookTitle) title: BookTitle;
    @field(String) member: string;
    constructor(title: BookTitle = new BookTitle(''), member = '') {
        this.title = title;
        this.member = member;
    }
}

@eventType()
export class ReturnDateSet {
    @field(Number) days: number;
    constructor(days = 0) { this.days = days; }
}

@command()
export class LendBook {
    @key() @field(BookId) bookId!: BookId;
    @field(String) member!: string;
    @field(Number) days!: number;

    @inject(commandReadModel(Book))
    handle(book: Book): [BookLent, ReturnDateSet] {
        return [new BookLent(book.title, this.member), new ReturnDateSet(this.days)];
    }
}

@validator(LendBook)
export class LendBookValidator extends CommandValidator<LendBook> {
    constructor() {
        super();
        this.ruleFor(command => command.member).notEmpty().withMessage('A member is required');
        this.ruleFor(command => command.days).greaterThan(0).withMessage('A loan lasts at least one day');
    }
}
```

`LendBook` reads the `Book` projected for its key and returns two events. Arc appends both to the book's event source in one batch.

## Pin the read model a command reads

`givenReadModel(Type, sourceId, instance)` sets the instance the scenario's event store returns for that read model and ID. Pin it before `execute`:

```typescript title="Features/Books/Lending/for_LendBook/when_lending/with_a_book_in_the_catalog.ts"
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { AuthorId } from '../../../../Authors/AuthorId.js';
import { BookId } from '../../../BookId.js';
import { BookTitle } from '../../../BookTitle.js';
import { Book } from '../../../Listing/Listing.js';
import { BookLent, LendBook, LendBookValidator, ReturnDateSet } from '../../Lending.js';

describe('when lending a book in the catalog', () => {
    const scenario = ChronicleCommandScenario.for(LendBook, BookLent, ReturnDateSet, LendBookValidator, Book);
    const bookId = BookId.create();
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => {
        const book = new Book();
        book.id = bookId;
        book.authorId = AuthorId.create();
        book.title = new BookTitle('Kindred');
        scenario.givenReadModel(Book, bookId.toString(), book);
        result = await scenario.execute({ bookId, member: 'member-1', days: 14 });
    });
    afterAll(async () => { await scenario.dispose(); });
    it('should append the loan and its return date to the book', () => {
        result.shouldBeSuccessful();
        result.appendedEvents.should.have.lengthOf(2);
        result.shouldHaveAppendedEvent(BookLent, bookId.toString(),
            event => event.title.value === 'Kindred' && event.member === 'member-1');
        result.shouldHaveAppendedEvent(ReturnDateSet, bookId.toString(), event => event.days === 14);
    });
    it('should append the events in the order handle() returned them', () => {
        result.appendedEvents.map(appended => appended.event.constructor).should.deep.equal([BookLent, ReturnDateSet]);
    });
});
```

Pass everything the command touches to `for(...)`: its event types, validators, and read model types. The in-memory log refuses an event type that is not registered. A read model type that is not registered fails the execution with `Expected one read-model resolver for Book, found 0`.

A pinned read model belongs to one ID and one tenant:

- The tenant defaults to `Default`, which is also the tenant a scenario uses when `scenario.context` sets none. Pass the tenant as the fourth argument when the test sets `tenantId` on the context.
- A command read model that is not pinned is missing. `commandReadModel(Book)` rejects the command, and `commandReadModel(Book, { optional: true })` hands `handle()` a `null`.
- A command that injects `ChronicleReadModels` and calls `findInstanceById` or `getById` receives the pinned instance for any ID, not only the command key. `getAll` and the observe methods are not backed by the in-memory store.

A pinned read model is a fixed value. The scenario does not run the projection that would build it, and a later execution does not update it. To check a projection, use the [kernel scenario](#seed-an-event-sources-history).

## Assert several appended events

A result carries the events appended by **that** execution:

- `result.appendedEvents` lists them in the order the command returned them. Each entry has the `event` instance, its `source`, `tenant`, `eventSourceType`, `eventStreamType`, `eventStreamId`, `subject`, and `tags`.
- `result.shouldHaveAppendedEvent(Type, sourceId?, predicate?)` passes when at least one of them matches. Call it once per event you expect.

`shouldHaveAppendedEvent` does not check how many events were appended or in which order. Assert the count on `appendedEvents` when an extra event would be a defect, and compare the event types when the order matters, as the example above does.

`scenario.appendedEvents` holds every event appended since the scenario was created. Use it only when a test runs several commands and asserts their combined output.

## Assert that nothing was appended

A rejected command appends nothing. Assert the reason and the empty result:

```typescript
describe('when lending a book that is not in the catalog', () => {
    const scenario = ChronicleCommandScenario.for(LendBook, BookLent, ReturnDateSet, LendBookValidator, Book);
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => { result = await scenario.execute({ bookId: BookId.create(), member: 'member-1', days: 14 }); });
    afterAll(async () => { await scenario.dispose(); });
    it('should reject the command without appending', () => {
        result.shouldNotBeSuccessful();
        result.shouldHaveValidationErrorFor('Book was not found for the command key');
        result.appendedEvents.should.have.lengthOf(0);
    });
});

describe('when lending a book for no days', () => {
    const scenario = ChronicleCommandScenario.for(LendBook, BookLent, ReturnDateSet, LendBookValidator, Book);
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => { result = await scenario.execute({ bookId: BookId.create(), member: 'member-1', days: 0 }); });
    afterAll(async () => { await scenario.dispose(); });
    it('should reject the loan period without appending', () => {
        result.shouldHaveValidationErrorForMember('days');
        result.appendedEvents.should.have.lengthOf(0);
    });
});
```

These blocks continue the spec file above. The second one pins no read model and still gets a clean validation failure, because validators run before Arc loads the read model for `handle()`. The [command assertions](commands.md#assertions) work on every Chronicle result.

To run a command as a signed-in user, set the principal on `scenario.context`, as the Library sample's [`RegisterAuthor` spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Registration/for_RegisterAuthor/when_registering/with_librarian_role.ts) does.

## Seed an event source's history

The in-memory scenario has no way to seed events. Events from an earlier `execute` stay in its log, but nothing reads them back: a pinned read model does not change, and an aggregate cannot load. When the decision depends on stored history, use `ChronicleKernelScenario` and seed it with `given.events(...)`.

An aggregate is the usual case. This slice returns a book. The `Loan` aggregate replays the book's loans, and `handle()` rejects the return of a book that is not lent:

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

In an application, place `Returning.ts` under `Features/Books/Returning/` and run the [proxy generator](../proxy-generation/getting-started.md) against `Features/`, writing metadata to `Features/generatedMetadata.ts`. Use absolute paths for the generator options, as in the linked script. Load the generated metadata and `discover()` the `Features/` folder after `withChronicle`, as in [Add event sourcing](../chronicle/add-event-sourcing.md). The generator omits the rejection branch from `ReturnBook`'s client response; the rejection reaches the caller as a validation failure.

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

Seeding also drives projections. The Library sample's [kernel suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/kernel-scenarios.test.mjs) seeds a `BookAdded`, waits for the `Book` read model with `shouldHaveReadModel`, and then executes `AddBook`. [Test Chronicle commands against a kernel](chronicle-kernel.md) explains how to start a kernel, how the observer wait behaves, and how to assert constraint and concurrency rejections.

## What the scenarios offer

| Member | Scenario | Meaning |
| --- | --- | --- |
| `for(Command, ...artifacts)` | In-memory | Create the scenario; pass event types, validators, and read models |
| `for(Command, artifacts, { connectionString?, timeoutMs? })` | Kernel | Create the scenario against a fresh event store; the observer wait defaults to 10 seconds |
| `context` | Both | Trusted request values, such as the principal and tenant |
| `givenReadModel(Type, sourceId, instance, tenant?)` | In-memory | Pin a read model instance; the tenant defaults to `Default` |
| `given.events(...events)` | Kernel | Append seed events and wait for the observers |
| `execute(values)` | Both | Run the command; the result has the usual [command assertions](commands.md#assertions) |
| `result.appendedEvents` | Both | The events this execution appended |
| `result.shouldHaveAppendedEvent(Type, sourceId?, predicate?)` | Both | An event of that type was appended in this execution, optionally to a source and matching a predicate |
| `scenario.appendedEvents` | In-memory | Every event appended since the scenario was created |
| `shouldHaveReadModel(Type, id, predicate?)` | Kernel | The kernel holds a matching read model |
| `dispose()` | Both | Release the scenario; call it after every test |

## What the in-memory scenario does not do

The in-memory log records the events a command appends, with their routing, subject, and tags, and it accepts concurrency scopes. It does not enforce concurrency or constraints, run projections or reactors, load aggregates, or replace the kernel suite. Use the [kernel scenario](chronicle-kernel.md) for those, or `Source/Chronicle/run-integration.sh` for adapter-level integration checks.

## Related

- [Chronicle commands](../chronicle/commands/index.md)
- [Read models in commands](../chronicle/read-models/injecting-into-commands.md)
- [Aggregates](../chronicle/aggregates/index.md)
- [Test Chronicle commands against a kernel](chronicle-kernel.md)
- [Testing commands](commands.md)
