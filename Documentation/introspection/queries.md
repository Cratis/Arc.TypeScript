---
title: Query introspection
description: The shape of GET /.cratis/queries, with one entry per registered query, its full name, and its arguments JSON Schema.
---

`GET /.cratis/queries` returns a JSON array with one entry per registered query, observable queries included. For the Tasks sample's `taskById`:

```json
{
  "name": "taskById",
  "namespace": "Tasks.Listing.TaskItem",
  "route": "/api/tasks/listing/task-by-id",
  "type": "taskById",
  "documentationSummary": "",
  "fullyQualifiedName": "Tasks.Listing.TaskItem.taskById",
  "argumentsSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "id": { "type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", "format": "uuid" }
    },
    "required": ["id"]
  }
}
```

| Field | Meaning |
| --- | --- |
| `name` | The query name; for a model-bound query, the method name |
| `namespace` | For a model-bound query, the discovery namespace plus the read-model class |
| `route` | The GET route |
| `type` | The query name |
| `documentationSummary` | A low-level definition's `summary`, or `""` |
| `fullyQualifiedName` | The identity used by direct calls and hub subscriptions, such as `Tasks.Listing.TaskItem.taskById` |
| `argumentsSchema` | JSON Schema 2020-12 of the arguments; `{ "properties": {} }` when there are none |

Reserved paging and sorting parameters are not part of `argumentsSchema`.

## Related

- [Introspection](index.md)
- [Command introspection](commands.md)
