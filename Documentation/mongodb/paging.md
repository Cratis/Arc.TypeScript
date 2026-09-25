---
title: MongoDB paging
description: Count, sort, and page a MongoDB query in the database with queryPage, and know which sort fields are accepted and what consistency to expect.
---

Paging a large collection in memory loads every document. `MongoCollection.queryPage` pushes the count, sort, skip, and limit into MongoDB and returns an Arc page with the real total.

```typescript
@query(service(tasks), queryOptions())
static async page(items: MongoCollection<TaskRecord>, options: QueryOptions) {
    return items.queryPage({}, options);
}
```

`GET /api/.../page?page=0&pageSize=10&sortBy=title` answers with ten documents sorted by title and `paging.totalItems` counted by MongoDB.

## Rules

- `queryPage(filter, options)` defaults to the first `maxPageSize` rows when paging is absent. Each read is capped at `maxPageSize`, 100 by default and at most 10,000. If the count exceeds the cap, Arc rejects the incomplete unpaged result with 400 rather than returning partial data.
- Only fields declared on the model may be sorted. The Arc wire name resolves to the declared property, then to its BSON name under the selected [naming policy](naming-policies.md). An unknown field, including `$where`, answers 400.
- An `_id` tie-breaker makes page order stable. An application-provided default sort is used when the request asks for none.
- For an intentionally unbounded list, use `items.find()`; do not use it on large collections.

## Consistency

The count and the find are separate reads. A concurrent write can change the count between them; this is not a snapshot transaction.

## Related

- [Paging and sorting](../queries/model-bound/paging.md)
- [Observing collections](observing-collections.md)
