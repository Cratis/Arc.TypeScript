---
title: Testing queries
description: Run a decorated static query through the real pipeline with QueryScenario, pass arguments, paging, and sorting, and assert the wire-shaped result.
---

`QueryScenario` selects one decorated `@query` method on a read model and performs it through the real query pipeline.

## Perform a query with paging and sorting

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/for_TaskItem/when_performing/with_sorting_and_paging.ts) registers two tasks and asks for the first page, sorted by title:

```typescript
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
        result = await context.query.perform({}, { sorting: { field: 'title', direction: 'asc' }, paging: { page: 0, pageSize: 1 } });
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

```typescript title="for_TaskItem/given/a_task_listing.ts"
import { ObservableQueryScenario, QueryScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { TaskItem } from '../../TaskItem.js';

export class a_task_listing {
    tasks = new Tasks();
    query = QueryScenario.for<{ id: string; title: string }[]>(TaskItem, 'allTasks');
    observable = ObservableQueryScenario.for<{ id: string; title: string }[]>(TaskItem, 'observeAllTasks');

    constructor() {
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

## Related

- [Testing observable queries](observable-queries.md)
- [Paging and sorting](../queries/model-bound/paging.md)
