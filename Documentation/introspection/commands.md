---
title: Command introspection
description: The shape of GET /.cratis/commands, with one entry per registered command and its payload JSON Schema.
---

A tool that fills in a command form, or a test that checks nobody removed a command, needs the command's route and the exact shape of its body. `GET /.cratis/commands` returns a JSON array with one entry per registered command. For the Tasks sample, which registers its generated metadata:

```json
[{
  "name": "RegisterTask",
  "namespace": "Tasks.Registration",
  "route": "/api/tasks/registration/register-task",
  "type": "RegisterTask",
  "documentationSummary": "Register a task.",
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
| `documentationSummary` | A low-level definition's `summary`, or the JSDoc summary of a model-bound command when [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md) is registered; otherwise `""` |
| `payloadSchema` | JSON Schema 2020-12 of the request body |

A concept field appears as its underlying scalar, here a UUID string. Optional and defaulted fields are left out of `required`, a nullable field is `anyOf` its type and `null`, and an `@enumeration` field is `anyOf` one `const` per enum value. [Concepts in the document](../open-api/concepts.md), [Enums in the document](../open-api/enums.md), and [How types appear in the document](../open-api/schemas.md) cover each case; the same schema is the command's OpenAPI request body.

## Related

- [Introspection](index.md)
- [Query introspection](queries.md)
