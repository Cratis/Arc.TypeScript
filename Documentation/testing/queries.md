---
title: Testing queries
description: Run a decorated static query through the real pipeline with QueryScenario, pass arguments, paging, and sorting, and assert the wire-shaped result.
---

`QueryScenario` selects one decorated `@query` method on a read model and performs it through the real query pipeline.

## Perform a query with paging and sorting

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/for_TaskItem/when_performing/with_sorting_and_paging.ts) registers two tasks and asks for the first page, sorted by title:

```typescript
import { SortDirection } from '@cratis/arc.core';
import { given } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_listing } from '../given/a_task_listing.js';

describe('when performing the tasks query with sorting and paging', given(a_task_listing, context => {
    let result: Awaited<ReturnType<typeof context.query.perform>>;
    beforeAll(() => {
        context.tasks.register(TaskId.create(), new TaskTitle('Zebra'));
        context.tasks.register(TaskId.create(), new TaskTitle('Apple'));
    });
    beforeEach(async () => {
        result = await context.query.perform({}, { sorting: { field: 'title', direction: SortDirection.Ascending }, paging: { page: 0, pageSize: 1 } });
    });
    afterAll(async () => { await context.query.dispose(); await context.observable.dispose(); });
    it('should return the first sorted wire value', () => {
        result.isSuccess.should.equal(true);
        String(result.data?.[0]?.title).should.equal('Apple');
    });
    it('should report the total number of items', () => { result.paging.totalItems.should.equal(2); });
}));
```

Its context creates the scenarios:

```typescript title="Features/Tasks/Listing/for_TaskItem/given/a_task_listing.ts"
import { ObservableQueryScenario, QueryScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { TaskItem } from '../../Listing.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_task_listing {
    tasks = new Tasks();
    query = QueryScenario.for<{ id: string; title: string }[]>(TaskItem, 'allTasks');
    observable = ObservableQueryScenario.for<{ id: string; title: string }[]>(TaskItem, 'observeAllTasks');

    constructor() {
        this.query.extend(builder => builder.useGeneratedMetadata(metadata));
        this.observable.extend(builder => builder.useGeneratedMetadata(metadata));
        this.query.services.addSingleton(Tasks, this.tasks);
        this.observable.services.addSingleton(Tasks, this.tasks);
    }
}
```

## How it works

- `QueryScenario.for<T>(ReadModel, 'methodName', ...artifacts)` selects the query. `T` describes the **wire** data, not a rehydrated read-model instance: `data` is JSON-shaped, so concepts arrive as strings.
- `perform(arguments, options?)` takes named arguments, such as `{ id: TaskId.create() }`, and optional `{ paging, sorting }`.
- The result is the actual `QueryResult`. Queries always use `Warning` as the allowed severity.
- `withContext({ principal, tenantId })` sets a trusted identity, as for commands.

## Query Chronicle read models in memory

`ChronicleQueryScenario` runs a snapshot query through the same Arc query pipeline, with tenant-scoped in-memory Chronicle state. A query can inject `ChronicleReadModels` and call `getById` or `findInstanceById` to read a seeded source. Register the query's event, reducer, and read-model types as artifacts:

```typescript title="Features/Accounts/for_AccountBalance/when_querying/with_seeded_history.ts"
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { reducer } from '@cratis/chronicle/reducers';
import { readModel as chronicleReadModel } from '@cratis/chronicle/readModels';
import { argument, query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { ChronicleQueryScenario } from '@cratis/arc.chronicle/testing';

@eventType() class BalanceChanged { @field(Number) amount: number; constructor(amount = 0) { this.amount = amount; } }
@chronicleReadModel() class AccountBalance { @field(Number) amount = 0; }
@reducer('account-balance-query-reducer', undefined, AccountBalance)
class BalanceReducer {
    balanceChanged(event: BalanceChanged, current?: AccountBalance): AccountBalance {
        return { amount: (current?.amount ?? 0) + event.amount };
    }
}
@readModel() class AccountQueries {
    @query(argument('id', String), service(ChronicleReadModels))
    static byId(id: string, models: ChronicleReadModels): Promise<AccountBalance | null> {
        return models.getById(AccountBalance, id);
    }
}

const scenario = ChronicleQueryScenario.for<{ amount: number }>(AccountQueries, 'byId',
    AccountBalance, BalanceChanged, BalanceReducer);
scenario.given.forEventSource('account-1').events(new BalanceChanged(25));
const result = await scenario.perform({ id: 'account-1' });
result.data!.amount.should.equal(25);
await scenario.dispose();
```

`given.forEventSource(id, tenant?).readModel(instance)` pins a value for that source, read-model type, and tenant; pins win over reducer history. `givenReadModel(Type, id, instance, tenant?)` can also pin by explicit type. Without a pin or reducible history, a keyed lookup returns `null`. The tenant defaults to the current trusted `scenario.context.tenantId` (or `Default`) **when** `.events()` or `.readModel()` is called; `withContext({ tenantId })` selects the tenant used by the query. Only keyed lookups are backed in memory. `getAll` and store watches reject with a kernel hint. Declared observable queries cannot be performed by `ChronicleQueryScenario`: observation needs `ChronicleKernelScenario` because `ObservableQueryScenario` has no in-memory Chronicle wiring. Seeded projection history also requires a kernel. Event seeding needs `@cratis/chronicle` 6.14 or later. See [Testing Chronicle commands](chronicle.md) for the same seeding rules and [kernel scenarios](chronicle-kernel.md) for projections.

## Snapshot versus streaming

`QueryScenario.perform()` rejects decorated `@query({ observable: true })` methods instead of returning a current snapshot as `ArcServer.performQuery()` does. For non-Chronicle observable queries, use [ObservableQueryScenario](observable-queries.md). `ChronicleQueryScenario.perform()` also rejects declared observable queries and directs you to `ChronicleKernelScenario` for observation.

A method declared as a snapshot that unexpectedly returns a subscribable or async iterable is rejected by the core query pipeline without touching the returned source. `QueryScenario` alone attempts bounded, cancellation-aware cleanup of that source before returning the snapshot boundary failure; production callers never unsubscribe, dispose, or create an iterator on a shared source.

## Related

- [Testing observable queries](observable-queries.md)
- [Paging and sorting](../queries/model-bound/paging.md)
