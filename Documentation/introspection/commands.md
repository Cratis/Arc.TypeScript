---
title: Command introspection
description: The shape of GET /.cratis/commands, with one entry per registered command and its payload JSON Schema.
---

`GET /.cratis/commands` returns a JSON array with one entry per registered command. For the Tasks sample:

```json
[{
  "name": "RegisterTask",
  "namespace": "Tasks.Registration",
  "route": "/api/tasks/registration/register-task",
  "type": "RegisterTask",
  "documentationSummary": "",
  "payloadSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "id": { "type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", "format": "uuid" },
      "title": { "type": "string" }
    },
    "required": ["id", "title"]
  }
}]
```

| Field | Meaning |
| --- | --- |
| `name` | The command name |
| `namespace` | The namespace, or `""` |
| `route` | The execution route; the validation route is this plus `/validate` |
| `type` | The command name |
| `documentationSummary` | A low-level definition's `summary`, or `""` |
| `payloadSchema` | JSON Schema 2020-12 of the request body |

A concept field appears as its underlying scalar, here a UUID string. Optional, nullable, default, and enumeration metadata are reflected in `required`, types, and `enum`.

## Related

- [Introspection](index.md)
- [Query introspection](queries.md)
