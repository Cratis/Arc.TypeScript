---
title: Intercept read models
description: Transform a read-model instance in each scoped snapshot and observable emission before it reaches the wire.
---

Several queries return the same read model, and each one has to trim or reshape it the same way before it leaves the server. Copying that logic into every query method means the next query forgets it. A read-model interceptor transforms the model once, for every query that returns it.

Arc runs the interceptor on ordinary query results, on observable HTTP snapshots, and on **each** stream emission, before encoding the model. That includes the items of a provider-owned `queryPage`; totals and paging stay with the provider.

## Write an interceptor

```ts
import { ArcApplication, readModelInterceptor, type ReadModelInterceptor } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';

class AccountSummary {
    @field(String) name!: string;
}
@readModelInterceptor()
class PublicAccountName implements ReadModelInterceptor<AccountSummary> {
    readonly model = AccountSummary;
    intercept(account: AccountSummary): AccountSummary {
        const copy = new AccountSummary();
        copy.name = account.name.trim();
        return copy;
    }
}

const builder = ArcApplication.createBuilder();
builder.add(PublicAccountName); // Or register a service and call addReadModelInterceptor(token).
// Add your decorated read model and other services, then call builder.build().
```

Return a replacement. Do not mutate a model that another subscriber may share.

## How interceptors run

- `builder.discover()` also loads `@readModelInterceptor()` classes. They default to a scoped service lifetime.
- Interceptors run in registration order and match the **exact runtime class** of each item. They do not apply to unrelated scalar values or to plain objects of a different class.
- The same scoped instance serves every emission in one subscription and is disposed when that subscription closes.
- A failed interception fails the query or the emission. It cannot silently return the original data.
- Unlike the current .NET `ObservableQueryHttp` path, TypeScript also intercepts observable HTTP snapshots, so a GET cannot bypass the interceptor.

The [query pipeline](query-pipeline.md#result-stages) shows where interceptors run relative to renderers, paging, and emission guards.

:::caution[Not authorization]
An interceptor shapes data a caller is already allowed to see. Check access before the model is produced, in the query's authorization or inside the query method.
:::

## Next steps

- [Render provider-backed queries](renderers.md) covers provider-owned paging, which runs before interceptors.
- [Authorizing commands and queries](../authorizing-commands-and-queries.md#queries-roles-and-ownership) shows how to restrict which rows a caller receives.
