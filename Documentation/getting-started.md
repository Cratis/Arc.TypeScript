---
title: Get started with Arc for TypeScript
description: Build the model-bound Tasks sample, register a task, and read it with a query.
---

You can build an Arc backend without writing an HTTP controller. In this walkthrough, you run the Tasks sample, register a task through a command, and read it back through a query. The backend is a standalone Node.js server: no event store or database is required.

:::caution[Unpublished source preview]
No Arc for TypeScript package is published to npm. Work inside a clone of this repository; the API may change. See the [capability reference](reference/capabilities.md) before using it in a larger application.
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

Leave the server running. In another terminal, register a task using any valid UUID:

```bash
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task \
  -H 'content-type: application/json' \
  -d '{"id":"1a638f8e-4444-4444-8888-a0b10cdd9977","title":"Write a guide"}'
```

The HTTP status is 200. The Arc command result has `isSuccess: true` and `response: "1a638f8e-4444-4444-8888-a0b10cdd9977"`. The correlation ID is different for each request. Try omitting `title`: Arc answers 400 with a `malformedRequest` validation result without calling the handler.

## Read what you registered

```bash
curl http://127.0.0.1:3000/api/tasks/listing/all-tasks
curl 'http://127.0.0.1:3000/api/tasks/listing/task-by-id?id=1a638f8e-4444-4444-8888-a0b10cdd9977'
```

The first result's `data` contains an array with `{ "id": "1a638f8e-4444-4444-8888-a0b10cdd9977", "title": "Write a guide" }`. The second returns that object directly. `taskById` binds `id` by name, case-insensitively; a missing or invalid UUID produces a 400 `malformedRequest` result.

## See where the behavior lives

[`RegisterTask.ts`](../Samples/Tasks/Features/Tasks/Registration/RegisterTask.ts) declares the command fields with Fundamentals `@field` and puts the work in `handle()`. [`TaskItem.ts`](../Samples/Tasks/Features/Tasks/Listing/TaskItem.ts) declares a read model and its static `allTasks`, `taskById`, and observable `observeAllTasks` queries. Both depend on the same [`Tasks` service](../Samples/Tasks/Features/Tasks/Tasks.ts), which stores the items in memory. `TaskId` and `TaskTitle` are `ConceptAs` values, so the handler receives domain values while the wire carries strings.

[`main.ts`](../Samples/Tasks/main.ts) registers the singleton `Tasks` service, discovers decorated artifacts under `Features/`, builds the application, and starts its standalone Node host. Arc derives route namespace segments from folders below that discovery root; moving an artifact changes its route unless you give it an explicit namespace and path.

`POST <command-route>/validate` runs binding and validation without calling `handle()`:

```bash
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task/validate \
  -H 'content-type: application/json' \
  -d '{"id":"1a638f8e-4444-4444-8888-a0b10cdd9977","title":"Not stored"}'
```

You can inspect generated request schemas at `/.cratis/commands`, `/.cratis/queries`, and `/openapi.json`. These describe the decorated field types. They do not generate a TypeScript client proxy from the classes yet.

Next, [add a command](guides/commands.md), [bind a query](guides/read-models-and-queries.md), or [configure an application](guides/application-setup.md). If you already use explicit Zod definitions, [the low-level APIs](guides/low-level-definitions.md) remain available.
