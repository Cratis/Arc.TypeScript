---
title: Test Chronicle commands against a kernel
description: Seed events, run Arc commands, and assert projections and constraints in an isolated Chronicle event store.
---

Use `ChronicleKernelScenario` when a command depends on kernel behavior that the fast [in-memory command scenario](chronicle.md) does not enforce: constraints, observer completion, or projected read models. This experimental testing API requires a running Chronicle kernel and is **not** part of the default `yarn ci` check.

## Run the Library kernel scenarios

From the repository root, with Docker available:

```shell
yarn workspace @cratis/arc.sample.library test:kernel
```

The script starts `cratis/chronicle:latest-development` on a free loopback port with a unique container name, then stops and removes **only that container** on exit. To use an already-running kernel instead, set `ARC_CHRONICLE_TEST_URL` to its `chronicle://host:port` connection string; the script does not stop that kernel. A missing Docker service or an unreachable kernel fails the opt-in check rather than skipping it.

The [Library suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/kernel-scenarios.test.mjs) registers the slice's artifacts, seeds a `BookAdded`, executes `AddBook` through Arc, and asserts the resulting `Book` projection. It also checks `UniqueAuthorName` rejection on a second `RegisterAuthor` in the same store. Each scenario chooses a new event-store name; dispose the scenario after the test. The helper owns and disposes its SDK client, but does not delete the kernel's persisted event store.

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

This is an excerpt; `AddBook`, `BookAdded`, `Book`, and the value types come from the Library sample. `for(Command, artifacts, { connectionString?, timeoutMs? })` uses `ARC_CHRONICLE_TEST_URL` by default, with a 10-second observer wait. `scenario.context` supplies trusted Arc request values such as a librarian principal. `given.events(...)` seeds registered events and waits for the kernel's observer completion signal before returning. `execute(...)` returns the real Arc `ScenarioCommandResult` with `appendedEvents` (events since this call began) and `shouldHaveAppendedEvent(Type, sourceId?, predicate?)`. Assertions against a rejected append use `result.shouldNotBeSuccessful()` and inspect `result.validationResults` for `constraintViolation` or `concurrencyViolation`.

`waitForCompletion` waits until affected observers process the append tail **or fail**; a timeout or failed observer makes the scenario fail, rather than claiming that the read model is ready. The wait is not a transaction across observers and side effects. Other concurrent writers or a later replay may change the model after this check. A scenario cannot recover a failed observer by sleeping; diagnose it in Chronicle instead.
