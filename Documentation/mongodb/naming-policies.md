---
title: Naming policies
description: Choose how MongoDB property and collection names are derived, match Arc on .NET when both read one database, write a custom policy, and use the stored names in your own filters.
---

A .NET service writes `Tasks` documents with a `Title` property. Your TypeScript service reads the same database, and its model declares `title`. Unless both sides agree on names, the TypeScript side reads documents with every field missing, and nothing fails. The naming policy decides the stored name of every property and the name of every collection.

## Choose a preset

| Policy | Properties | Collections | .NET equivalent |
| --- | --- | --- | --- |
| `defaultMongoNamingPolicy` (default) | As declared | Pluralized read-model class name, case kept | Unconfigured MongoDB builder (`new DefaultNamingPolicy()`) |
| `camelCaseMongoNamingPolicy` | Camel-cased | Pluralized, camel-cased | `.WithCamelCaseNamingPolicy()` |

For example, a `TaskRecord` class with `Id` and `Title` fields:

| | Default | Camel case |
| --- | --- | --- |
| Collection | `TaskRecords` | `taskRecords` |
| `Title` field | `Title` | `title` |
| `URL` field | `URL` | `URL` |
| `@key()` field | `_id` | `_id` |

Both presets keep a leading acronym together, as .NET does: `URL` stays `URL` under camel case.

With the default policy, the stored name is exactly the TypeScript field name. To read documents a default-policy .NET service wrote, spell the field as .NET does, `Title`, not `title`. When the .NET side uses camel case, use `camelCaseMongoNamingPolicy` and keep idiomatic TypeScript field names.

## Set a policy

```typescript
import { camelCaseMongoNamingPolicy } from '@cratis/arc.mongodb';

builder.withMongoDB({ client, database: 'tasks', readModels: [TaskRecord], namingPolicy: camelCaseMongoNamingPolicy });
```

The policy applies to every model registered in that `withMongoDB` call, including nested models and derived types.

## Pluralization

Both presets pluralize the class name with a few English rules: a name ending in `s`, `x`, `z`, `ch`, or `sh` takes `es`, a consonant followed by `y` becomes `ies`, and everything else takes `s`. So `Category` becomes `Categories` and `Box` becomes `Boxes`.

.NET pluralizes with Humanizer, which knows irregular words: `Person` becomes `People` there, but `Persons` here. When the two disagree, set the name yourself.

## Override the collection name

To change only the collection, keep the policy and pass `collectionName`:

```typescript
builder.withMongoDB({ client, database: 'library', readModels: [Person],
    collectionName: model => model === Person ? 'People' : `${model.name}s` });
```

The function receives each registered model class and must return a nonempty name for all of them, or the request that resolves the collection fails with `MongoDB collection name is required`.

## Chronicle-projected read models

When Chronicle projects a read model into MongoDB, the collection name has to match the one Arc reads. If the Chronicle client is created by [`withChronicle`](../chronicle/registration-options.md) with a `connectionString` and the application also calls `withMongoDB`, Arc gives that client a naming policy that applies this page's rule to the read model class: `collectionName?.(model) ?? namingPolicy.collectionName(model)`. A projected `User` lands in `Users` under the default policy and in `users` under `camelCaseMongoNamingPolicy`, with no extra setup. The same collection name is used whether `withMongoDB` is called before or after `withChronicle`.

The policy changes only the collection name. A read model that Chronicle knows only by identifier, such as a projection with a custom `.containerName(...)`, keeps that identifier as its collection name. The database must still match: Chronicle writes the default namespace's read models to a database named after the event store, and to `<event store>+<namespace>` for any other namespace. `withMongoDB` uses `<database>` and `<database>+<tenantId>`, so set `database` to the event store name.

Two cases are not wired automatically:

- **You pass your own Chronicle `client`.** Arc never changes a client it does not own. Create it with `ChronicleOptions.fromConnectionString(connectionString, { readModelNamingPolicy })` and return the name you want, for example `(identifier, readModelType) => readModelType ? resolveMongoCollectionName(mongoOptions, readModelType) : identifier`. `resolveMongoCollectionName`, exported from `@cratis/arc.mongodb`, is the function Arc itself uses, and `mongoOptions` is an object with the same `namingPolicy` and `collectionName` you pass to `withMongoDB`. Passing `readModelNamingPolicy` to `withChronicle` together with a `client` throws.
- **You pass `readModelNamingPolicy` to `withChronicle`.** Your policy replaces the automatic one.

Without `withMongoDB`, Arc sets no policy and Chronicle names the collection after the read model identifier. The automatic policy needs `@cratis/chronicle` 6.29.0 or later, which is the lowest version `@cratis/arc.chronicle` accepts.

:::caution[Upgrading]
Before this behavior, a projected read model was stored in a collection named after its identifier, such as `User`, which the default `withMongoDB` policy never read. A workaround was `collectionName: model => model.name`. That workaround still gives `User`, so an application that uses it keeps its collection. An application on the default policy now has Chronicle register `Users` instead. The kernel does not move data out of the old collection, so replay the projection to fill the new one from the event log. Until then, reads through `ChronicleReadModels` also come from the new collection, because they go through the kernel's current definition.
:::

## Write a custom policy

A `MongoNamingPolicy` is two functions:

```typescript
import type { MongoNamingPolicy } from '@cratis/arc.mongodb';

export const snakeCase: MongoNamingPolicy = {
    propertyName: name => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
    collectionName: type => type.name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
};
```

Write one when a .NET service uses a customized policy, or when your database already has its own convention. `propertyName` is never called for the key: the `@key()` field is always stored as `_id`.

## Names in your own filters

`find`, `queryPage`, and `observe` take a raw MongoDB filter. The filter goes to the driver as written, so it must use **stored** names and **stored** values. For a model with a `status` field and a `Guid` key:

```typescript
import type { Document, Filter } from 'mongodb';

const done = await items.find({ [items.codec.fieldName('status')]: 'done' });
const one = await items.find({ _id: items.codec.id(taskId) } as Filter<Document>);
```

`codec.fieldName(name)` converts a model field name to its stored name under the active policy, accepts the wire name too, and throws for a name the model does not declare. `codec.id(value)` encodes a key value, such as a `Guid`, the way it is stored. A `Guid` in any other field is stored as UUID binary, so a plain string will not match it.

## Sorting and errors

Client sorting goes through the same mapping. A request with `sortBy=title` resolves `title` to the declared field and then to its stored name. A name that is not a declared field, such as `secret` or `$where`, answers 400 before MongoDB is queried. See [Paging](paging.md).

| Mistake | What happens |
| --- | --- |
| Field spelled differently from the stored documents | Reads succeed, and the field stays unset on every instance |
| Policy differs from the service that wrote the documents | Same: reads succeed with missing values |
| Collection name differs | Reads return nothing, and writes go to a new collection |
| Unknown sort field | 400 |

The first three produce no error. When a query returns empty or half-filled models, compare the stored names with `codec.fieldName(...)` and the collection name first.

## Related

- [Serializers](serializers.md)
- [Get started with MongoDB](getting-started.md)
