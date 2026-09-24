---
title: Naming policies
description: Choose how MongoDB property and collection names are derived, and match Arc on .NET's default or camel-case policy when both read the same database.
---

When a TypeScript service and a .NET service share a MongoDB database, both must agree on property and collection names. The naming policy decides them.

| Policy | Properties | Collections | .NET equivalent |
| --- | --- | --- | --- |
| `defaultMongoNamingPolicy` (default) | Declared names | Pluralized, case-preserving read-model names | Unconfigured MongoDB builder (`new DefaultNamingPolicy()`) |
| `camelCaseMongoNamingPolicy` | Camel-cased | Pluralized, camel-cased | `.WithCamelCaseNamingPolicy()` |

Both presets keep leading acronyms together. With the default policy, the TypeScript property spelling must match the .NET declaration, for example `Title`, not `title`.

## Set a policy

```typescript
import { camelCaseMongoNamingPolicy } from '@cratis/arc.mongodb';

builder.addMongoDB({ client, database: 'tasks', readModels: [TaskRecord], namingPolicy: camelCaseMongoNamingPolicy });
```

## Custom names

A `MongoNamingPolicy` supplies `propertyName` and `collectionName` functions. Write your own for irregular plurals handled by .NET's Humanizer or for customized .NET policies. To change only the collection name, pass the `collectionName` option.

Sorting uses the same policy: an Arc wire name such as `title` resolves to the declared property, then to its BSON name. See [Paging](paging.md).

## Related

- [Serializers](serializers.md)
