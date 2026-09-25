---
title: Testing Chronicle commands
description: Test event-sourced Arc commands without a kernel - assert the events a command appends, pin the read models it reads, and choose between the in-memory and kernel-backed scenarios.
---

An event-sourced command makes a decision and records it as events. A test for it answers three questions: what state did the command see, which events did it append, and what did it refuse. `@cratis/arc.chronicle/testing` has two scenarios for this, and this page covers the in-memory one. Both run the command through the real Arc pipeline: authorization, validation, `provide()`, `handle()`, and the Chronicle response handler.

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

Start with `ChronicleCommandScenario`. Most tests check the decision a command makes from the state it is given, and the in-memory scenario checks that in milliseconds. Move to `ChronicleKernelScenario` when the test depends on stored history, an aggregate, a projection, a constraint, or a concurrency check; [Test Chronicle commands against a kernel](chronicle-kernel.md) covers it.

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

A pinned read model is a fixed value. The scenario does not run the projection that would build it, and a later execution does not update it. To check a projection, use the [kernel scenario](chronicle-kernel.md#assert-a-projection).

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

## What the scenario offers

| Member | Meaning |
| --- | --- |
| `for(Command, ...artifacts)` | Create the scenario; pass event types, validators, and read models |
| `context` | Trusted request values, such as the principal and tenant |
| `givenReadModel(Type, sourceId, instance, tenant?)` | Pin a read model instance; the tenant defaults to `Default` |
| `execute(values)` | Run the command; the result has the usual [command assertions](commands.md#assertions) |
| `result.appendedEvents` | The events this execution appended |
| `result.shouldHaveAppendedEvent(Type, sourceId?, predicate?)` | An event of that type was appended in this execution, optionally to a source and matching a predicate |
| `scenario.appendedEvents` | Every event appended since the scenario was created |
| `dispose()` | Release the scenario; call it after every test |

## What the in-memory scenario does not do

The in-memory log records the events a command appends, with their routing, subject, and tags, and it accepts concurrency scopes. It does not enforce concurrency or constraints, run projections or reactors, load aggregates, or replace the kernel suite.

It also cannot seed events. Events from an earlier `execute` stay in its log, but nothing reads them back: a pinned read model does not change, and an aggregate cannot load. When the decision depends on stored history, use the [kernel scenario](chronicle-kernel.md#seed-an-event-sources-history), which seeds a book's loan and returns it through an aggregate. `Source/Chronicle/run-integration.sh` covers adapter-level integration checks.

## Related

- [Chronicle commands](../chronicle/commands/index.md)
- [Read models in commands](../chronicle/read-models/injecting-into-commands.md)
- [Aggregates](../chronicle/aggregates/index.md)
- [Test Chronicle commands against a kernel](chronicle-kernel.md)
- [Testing commands](commands.md)
