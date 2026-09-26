---
title: Commands in the document
description: See how each Arc command appears in /openapi.json as a POST operation with a JSON request body, a CommandResult envelope for 200, 400, 403, and 500, and a typed response when generated metadata declares one.
---

A client that calls your command needs to know three things: what to send, what comes back when it works, and what comes back when it does not. Arc answers all three from the command itself. Every command is described the same way, so a client handles one envelope shape for success and failure.

## One POST operation per command

The Tasks sample's `RegisterTask` command appears as:

| Part | Value |
| --- | --- |
| Method and path | `POST /api/tasks/registration/register-task`, from [endpoint mapping](../core/endpoint-mapping.md) |
| `operationId` | `Tasks.Registration.RegisterTask`, the namespace-qualified command name |
| `tags` | `["Tasks.Registration"]`, the namespace |
| `summary` | `Register a task.`, the JSDoc on the class, when [generated metadata](model-bound.md#summaries-and-result-types) is registered |
| `requestBody` | Required, `application/json`, the command's input schema |

The request body schema is built from the command's `@field` declarations, with the rules on [Concepts in the document](concepts.md) and [How types appear in the document](schemas.md). A [low-level definition](model-bound.md) uses its Zod schema instead.

## Responses

Every command documents four responses, all with the same `CommandResult` envelope, plus 401 when authentication can reject the request (see [401 responses](#401-responses)):

| Status | Meaning |
| --- | --- |
| 200 | The command ran |
| 400 | Validation failed, or the request body was malformed |
| 403 | The caller is not authorized |
| 500 | An unexpected server error |

The envelope has these properties, all required:

| Property | Type |
| --- | --- |
| `correlationId` | string |
| `isSuccess`, `isAuthorized`, `isValid`, `hasExceptions` | boolean |
| `validationResults` | array of `{ severity, message, members, reason, reasonDetail, state }` |
| `exceptionMessages` | array of strings |
| `exceptionStackTrace` | string |
| `authorizationFailureReason` | string |

## The typed response

When generated metadata declares what `handle()` returns, the 200 envelope adds an optional `response` property with that type. `RegisterTask.handle()` returns a `TaskId`, so its `response` is described as a UUID string, not as a `TaskId` object.

The 400, 403, and 500 envelopes never include `response`, because a failed command returns none. A command that returns nothing has no `response` property either.

Without generated metadata, the document leaves `response` out rather than guess it from the input or run the handler. The runtime response does not change; only its description is missing.

## The validation-only operation

Each command also has a `POST <route>/validate` operation, which runs authorization, filters, and validation without the handler. It shares the execute operation's request body, tag, and security requirements; its operationId is the execute operationId with `:validate` appended, such as `Tasks.Registration.RegisterTask:validate`. Its responses use the untyped command result envelope, because validation never returns a `response`.

## 401 responses

When authentication can reject a request, both the execute and the validation-only operation also list 401 with the untyped envelope: when default authentication handlers are configured (they run even on anonymous routes), when the command selects a named scheme, or when a host-supplied native principal is required on a protected route. Without any of these, Arc never answers 401 and the operations don't list it.

## What is not described

- **Routes outside Arc.** Arc for TypeScript has no controllers. Routes you add to Express, Fastify, or Hono yourself are not Arc commands and do not appear. There is no opt-out attribute, because every Arc command uses the envelope.

## Related

- [Queries in the document](queries.md)
- [Command outcomes](../commands/command-outcomes.md) for how the envelope is filled at runtime
- [OpenAPI](index.md#bearer-security) for bearer security on protected commands
