---
title: Model-bound and low-level operations
description: See where each part of an operation in /openapi.json comes from for model-bound commands and queries and for defineCommand and defineQuery definitions, and why summaries and result types need generated metadata.
---

Arc has two ways to declare an operation: model-bound classes with decorators, and low-level `defineCommand`, `defineQuery`, and `defineObservableQuery` definitions. Both appear in the same document through the same code, so there is no separate registration and no operation that falls through the cracks. What differs is where Arc gets each piece of information.

## Where each part comes from

| Part of the operation | Model-bound command or query | Low-level definition |
| --- | --- | --- |
| Route | [Endpoint mapping](../core/endpoint-mapping.md) from namespace and name | The same, or the definition's `path` |
| `operationId` | `Namespace.Command`, or `Namespace.ReadModel.method` for a query | `Namespace.Name` |
| `summary` | JSDoc on the command class or query method, through generated metadata | The definition's `summary` field |
| Input schema | `@field` declarations and query arguments, through the [wire rules](concepts.md) | `z.toJSONSchema` of the definition's Zod `schema` |
| `response` or `data` | The declared return type, through generated metadata | Not described |
| Security | Authorization decorators and registered bearer handlers | The `authorization` property and registered bearer handlers |

In the Tasks sample, the `RegisterTask` command is `Tasks.Registration.RegisterTask`, and the `allTasks` query on the `TaskItem` read model is `Tasks.Listing.TaskItem.allTasks`. The low-level `create` command in [Low-level definitions](../commands/low-level-definitions.md) is `Tasks.Create`.

## Summaries and result types

Arc reads your source only through the metadata it has at runtime. JSDoc comments and TypeScript return types are gone after compilation, so two parts of a model-bound operation need [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md) registered with `builder.useGeneratedMetadata(metadata)`:

- **Summaries.** Without metadata, `summary` is an empty string.
- **Result types.** Without metadata, the 200 envelope has no `response` or `data` property, and every query gets the paging parameters, because Arc cannot tell a single result from a list.

A low-level definition sets `summary` itself. Arc does not infer its result type from the handler, so its 200 envelope has no `response` or `data`, and a low-level query always lists the paging parameters.

## Input schemas from Zod

A low-level definition's schema is converted with Zod's own JSON Schema conversion, so it follows Zod's rules rather than Arc's wire rules:

- An object schema sets `additionalProperties: false`.
- In a command's request body, a `.optional()` field is not required, but a `.default(...)` field is listed as required and carries its `default`.
- For a query's parameters, Arc marks an argument required only when it rejects `undefined`, so `.optional()` and `.default(...)` arguments are both optional.

Keep low-level schemas convertible to JSON Schema; see [Command filters](../commands/command-filters.md#keep-the-schema-for-shape).

## Related

- [Commands in the document](commands.md)
- [Queries in the document](queries.md)
- [Low-level definitions](../commands/low-level-definitions.md)
