---
title: Testing observable queries
description: Open a decorated observable query through the real pipeline with ObservableQueryScenario, collect emissions under one deadline, and tell completion from rejection.
---

`ObservableQueryScenario` opens a live query through the real observable pipeline and collects what it emits, within a deadline you set.

## Collect emissions

The [Tasks sample spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/for_TaskItem/when_collecting/with_current_value.ts) registers a task and collects the current value:

```typescript
import { given } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_listing } from '../given/a_task_listing.js';

describe('when collecting the current tasks emission', given(a_task_listing, context => {
    let result: Awaited<ReturnType<typeof context.observable.collect>>;
    beforeEach(async () => {
        context.tasks.register(TaskId.create(), new TaskTitle('Review changes'));
        result = await context.observable.collect(1, 1_000);
    });
    afterAll(async () => { await context.query.dispose(); await context.observable.dispose(); });
    it('should receive the wire-shaped current value', () => {
        result.emissions.should.have.lengthOf(1);
        String(result.emissions[0]?.data?.[0]?.title).should.equal('Review changes');
    });
}));
```

The `a_task_listing` context is shown on [Testing queries](queries.md#perform-a-query-with-paging-and-sorting).

## collect()

`collect(count, timeoutMs = 5000, arguments = {}, options?)` waits for up to `count` emissions, or fails at the deadline, which also covers opening the subscription. The scenario closes its subscription in every case, including a timeout.

| Result field | Meaning |
| --- | --- |
| `emissions` | The query results received, wire-shaped |
| `completed` | `true` only when a finite stream completed before reaching `count` |
| `rejection` | The query result when opening was rejected, such as a failed authorization or validation |

A rejection is reported in `rejection` with `completed: false`, not as an emission. Always assert the expected emission count.

## Related

- [Observable queries](../queries/observable-queries.md)
- [Testing](index.md)
