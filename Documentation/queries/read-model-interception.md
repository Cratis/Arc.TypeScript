---
title: Intercept read models
description: Transform a read-model instance in each scoped snapshot and observable emission before it reaches the wire.
---
<!-- Copyright (c) Cratis. All rights reserved.
Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

When a query returns a read-model instance, register a scoped interceptor to
transform its presentation once, rather than repeating the logic in each
query. Arc runs it on ordinary query results, observable HTTP snapshots and
**each** stream emission before encoding the model. This includes provider-owned
`queryPage` items; totals and paging remain provider-owned.

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

`@readModelInterceptor()` classes can also be loaded by `builder.discover()`;
they default to a scoped service lifetime. Interceptors run in registration
order and match the **exact runtime class**
of each item. Return a replacement; do not mutate a model shared by another
subscriber. The same scoped instance serves all emissions in one subscription
and is disposed when that subscription closes. Failed interception fails the
query/emission; it cannot silently return the original data.

**Do not use this as authorization.** Check access before producing the model;
interceptors do not apply to unrelated scalar values or plain objects of a
different class. Unlike the current .NET `ObservableQueryHttp` path, TypeScript
also intercepts observable HTTP snapshots to avoid a bypass through GET.
For provider-owned paging see [query renderers](renderers.md).
