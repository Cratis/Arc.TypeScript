---
title: Get started with Arc for TypeScript
description: Build the model-bound Tasks sample, register a task with a command, and read it back with a query.
---

You can build an Arc backend without writing an HTTP route. In this walkthrough you run the Tasks sample, register a task through a command, and read it back through a query. The backend is a standalone Node.js server: no event store or database is required.

By the end you have a server on `127.0.0.1:3000` that answers a command, rejects invalid input before your code runs, and serves the task you stored.

:::caution[Source preview]
No Arc for TypeScript package is published to npm. Work inside a clone of this repository; the API may still change. Check the [capability reference](../reference/capabilities.md) before you use a feature in a larger application.
:::

## Build and run

Use Node.js 22.19 or later, Git, Corepack, and `curl`. The sample keeps tasks in memory and listens on loopback, port 3000. A restart clears its data.

```bash
git clone https://github.com/Cratis/Arc.TypeScript.git
cd Arc.TypeScript
corepack enable
yarn install
yarn build
yarn workspace @cratis/arc.core.sample.tasks start
```

`app.run()` keeps the server running until Ctrl+C (SIGINT), SIGTERM, or an explicit `app.stop()`, then closes gracefully. Set `PORT` to use another port. Leave the server running, and in another terminal register a task with any valid UUID:

```bash
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task \
  -H 'content-type: application/json' \
  -d '{"id":"1a638f8e-4444-4444-8888-a0b10cdd9977","title":"Write a guide"}'
```

The HTTP status is 200 and the command result looks like this (the correlation ID differs on every request):

```json
{"correlationId":"0c2d6872-c3cb-4a84-af93-1084caa4d22d","isAuthorized":true,"validationResults":[],"exceptionMessages":[],"exceptionStackTrace":"","authorizationFailureReason":"","isValid":true,"hasExceptions":false,"isSuccess":true,"response":"1a638f8e-4444-4444-8888-a0b10cdd9977"}
```

Now leave out `title`. Arc answers 400 with a `malformedRequest` validation result, and the handler never runs.

## Read what you registered

```bash
curl http://127.0.0.1:3000/api/tasks/listing/all-tasks
curl 'http://127.0.0.1:3000/api/tasks/listing/task-by-id?id=1a638f8e-4444-4444-8888-a0b10cdd9977'
```

The first result's `data` is an array holding `{ "id": "1a638f8e-4444-4444-8888-a0b10cdd9977", "title": "Write a guide" }`. The second returns that object directly. `taskById` binds `id` by name, case-insensitively; a missing or invalid UUID produces a 400 `malformedRequest` result.

## Check a rule without running the command

Every command also has a validation route. `POST <command-route>/validate` runs authorization and validation, then stops:

```bash
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task/validate \
  -H 'content-type: application/json' \
  -d '{"id":"1a638f8e-4444-4444-8888-a0b10cdd9977","title":""}'
```

The answer is 400 with one result: `{"severity":3,"message":"A title is required","members":["title"],"reason":"rule"}`. That message comes from the sample's validator, not from Arc.

## Look at what the server describes

The running application describes itself. `GET /.cratis/commands` and `GET /.cratis/queries` list every operation with its route and the JSON Schema of its input, and `GET /openapi.json` returns an OpenAPI 3.1 document. See [Introspection](../introspection/index.md) and [OpenAPI](../open-api/index.md).

## Recap

You started a server with no routing code, called a command and two queries over HTTP, and saw Arc reject bad input before the handler ran. All of that came from a few decorated classes.

## Next steps

- [Your first command](your-first-command.md) reads the sample file by file and explains what each decorator does.
- [Hosting overview](../overview.md) helps you choose between the standalone host and Express, Fastify, or Hono.
- [Generate proxies](../proxy-generation/index.md) gives your frontend typed clients for these operations.
