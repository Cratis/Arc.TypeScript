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

- Arc intercepts the top-level result, each array item, and each item of a `queryPage`. An instance nested deeper, for example `{ account, related }` or a joined `select` result, is not transformed. By default it is served as it is, exactly as before; an interceptor that must protect its model everywhere opts in with `isReleased` (below).

The [query pipeline](query-pipeline.md#result-stages) shows where interceptors run relative to renderers, paging, and emission guards.

## Protect a model wherever it appears

A plain interceptor, like the one above, only reshapes the slots Arc intercepts. When a model holds data that must never leave the server untransformed, such as encrypted personal data, implement the optional members that make the interceptor protect it:

- `isReleased(model)` opts the model in to protection. Arc then walks every result and emission, and fails the query if it finds an instance of the model for which `isReleased` does not return `true`, wherever it appears. When several interceptors for the same model implement it, all of them must return `true`. Interceptors that do not implement it are not consulted. When interception of a top-level result, array item or page item ends with an instance that a protecting interceptor does not report released, such as a masked copy returned by a later interceptor or another model's instance, Arc runs that model's protecting interceptors on it once more before checking it. For a protected Chronicle model this is one more Chronicle release per item, and the replacement must keep the model's `@subject()` property or `id` unless it holds no protected value.
- `interceptRawDocument(document, provenance)` transforms an untyped storage document marked with `markRawReadModelDocument()` as this model. If any interceptor for the model omits it, Arc fails the query rather than serve the raw document. A marked raw document may appear only as the top-level result, an array item, or a page item; anywhere else the query fails, whether or not the interceptor protects nested instances. Arc serves the interceptor's result, or the document itself when the model's interceptors return it unchanged; a different marked raw document returned by interception fails the query like a nested one. Arc never clears the stored document's mark, so a document emitted again is intercepted again.

```ts
@readModelInterceptor()
class ProtectedAccount implements ReadModelInterceptor<Account> {
    readonly model = Account;
    intercept(account: Account): Account { return release(account); }
    isReleased(account: Account): boolean { return wasReleased(account); }
    interceptRawDocument(document: object): object { return releaseDocument(document); }
}
```

The walk covers own enumerable values and skips typed arrays and buffers. It cannot see values reachable only through `toJSON()`, getters, or private fields, nor a document already copied into a new object, so return protected models directly rather than mapping them. The Chronicle integration registers a protecting interceptor for every read model that holds protected data; see [Chronicle compliance](../chronicle/compliance.md).

:::caution[Not authorization]
An interceptor shapes data a caller is already allowed to see. Check access before the model is produced, in the query's authorization or inside the query method.
:::

## Next steps

- [Render provider-backed queries](renderers.md) covers provider-owned paging, which runs before interceptors.
- [Authorizing commands and queries](../authorizing-commands-and-queries.md#queries-roles-and-ownership) shows how to restrict which rows a caller receives.
