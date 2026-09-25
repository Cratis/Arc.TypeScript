---
title: Get started with Arc for TypeScript
description: Run the Tasks sample, register a task with a command, watch Arc reject bad input, and read the task back with a query, all without writing an HTTP route.
---

Say you need a small task API: register a task, list the tasks, and refuse a task without a title. In a plain Node.js server that means a route per operation, body parsing, a validation response format, status-code mapping, and a client that has to know all of it. Every endpoint repeats the same plumbing, and every rename risks breaking the client.

With Arc you write the parts that are yours: a command class that registers a task, a validator with the rules, and a read model with the queries. Arc serves them over HTTP, checks input before your code runs, and wraps every answer in the same result shape.

In this walkthrough you run the Tasks sample from this repository and talk to it with `curl`. By the end you have a server on `127.0.0.1:3000` that accepts a command, rejects invalid input before the handler runs, and serves the tasks you stored. No event store or database is involved.

:::caution[Source preview]
No Arc for TypeScript server package is published to npm yet. Work inside a clone of this repository; the API may still change. Check the [capability reference](../reference/capabilities.md) before you rely on a feature in a larger application.
:::

## Build and run the sample

You need Node.js 22.19 or later, Git, Corepack, and `curl`.

```bash
git clone https://github.com/Cratis/Arc.TypeScript.git
cd Arc.TypeScript
corepack enable
yarn install
yarn build
yarn workspace @cratis/arc.core.sample.tasks start
```

The server listens on `127.0.0.1:3000` and keeps its tasks in memory, so a restart clears them. Set `PORT` to use another port. It runs until you press Ctrl+C or send SIGTERM, then closes its connections gracefully.

Leave it running and open a second terminal for the rest of this page.

## Register a task

Send the `RegisterTask` command with any UUID and a title:

```bash
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task \
  -H 'content-type: application/json' \
  -d '{"id":"1a638f8e-4444-4444-8888-a0b10cdd9977","title":"Write a guide"}'
```

The answer is HTTP 200 with a command result. The correlation ID differs on every request:

```json
{"correlationId":"0c2d6872-c3cb-4a84-af93-1084caa4d22d","isAuthorized":true,"validationResults":[],"exceptionMessages":[],"exceptionStackTrace":"","authorizationFailureReason":"","isValid":true,"hasExceptions":false,"isSuccess":true,"response":"1a638f8e-4444-4444-8888-a0b10cdd9977"}
```

Nobody wrote that route. Arc derived `/api/tasks/registration/register-task` from the folder the command lives in and its class name. It parsed the body against the command's declared fields, turned the ID string into a typed `TaskId`, ran the validators, and called the command's `handle()` method. The `response` is the ID that `handle()` returned, encoded back to a string. The flags (`isSuccess`, `isValid`, `isAuthorized`, `hasExceptions`) are the same on every command, so a client checks one shape everywhere.

## Break the rules

Now send a task with an empty title:

```bash
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task \
  -H 'content-type: application/json' \
  -d '{"id":"2b638f8e-4444-4444-8888-a0b10cdd9977","title":""}'
```

The answer is 400, and `validationResults` holds one entry:

```json
{"severity":3,"message":"A title is required","members":["title"],"reason":"rule"}
```

That message comes from the sample's validator, and `members` tells a form which field to mark. The handler never ran, so nothing was stored.

Leave `title` out of the body entirely and you get a different 400: one result with reason `malformedRequest` and no members. Arc separates a request with the wrong *shape* (a missing field, a wrong type, broken JSON) from a request that breaks a *rule* a user can fix. Only rules carry a message meant for a person.

A frontend often wants to check a rule before the user presses Save. Every command has a second route for that: `POST <command-route>/validate` runs authorization and validation, then stops:

```bash
curl -X POST http://127.0.0.1:3000/api/tasks/registration/register-task/validate \
  -H 'content-type: application/json' \
  -d '{"id":"2b638f8e-4444-4444-8888-a0b10cdd9977","title":"!Loud"}'
```

The answer is 400 with `A title cannot begin with an exclamation mark` for the member `title`. That rule belongs to the task title itself, wherever it appears. [Your first command](your-first-command.md) shows where each rule lives.

## Read what you registered

Queries are GET requests:

```bash
curl http://127.0.0.1:3000/api/tasks/listing/all-tasks
curl 'http://127.0.0.1:3000/api/tasks/listing/task-by-id?id=1a638f8e-4444-4444-8888-a0b10cdd9977'
```

The first answer's `data` is an array holding `{ "id": "1a638f8e-4444-4444-8888-a0b10cdd9977", "title": "Write a guide" }`. The second answers with that object directly. Arc bound `id` from the query string by name and converted it to a `TaskId`; a missing or invalid UUID answers 400 with `malformedRequest`. An ID nobody registered answers 200 without a `data` property: absence is an answer, not an error.

Add `?pageSize=1&sortBy=title` to the first URL and Arc pages and sorts the list for you, reporting the totals in `paging`. The query method itself only returns an array.

## See what started the server

The whole entry point is [`Samples/Tasks/main.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/main.ts):

```typescript title="Samples/Tasks/main.ts"
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { metadata } from './Features/generatedMetadata.js';

// The workspace command runs from Samples/Tasks and binds Development from appsettings.json.
const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

Each line has one job:

| Line | What it does |
| --- | --- |
| `createBuilder()` | Starts an Arc application and reads optional `appsettings.json` (`Cratis:Arc`) and `Cratis__...` environment variables |
| `useGeneratedMetadata(metadata)` | Installs parameter and return-type information that the proxy generator extracted from the source, because TypeScript erases types at runtime |
| `services.addSingleton(Tasks)` | Registers the in-memory store that the command and queries receive |
| `discover(...)` | Imports the modules under `Features/` (skipping `for_*` spec folders) and picks up commands, read models, and validators by their decorators |
| `build()` | Checks the whole graph (every injected service registered, no lifetime mismatches, no misplaced decorators) before any listener opens |
| `run(...)` | Starts the standalone Node.js host and maps every route |

If you forget to register `Tasks`, `build()` throws `Missing service: Tasks` at startup, instead of the first request failing in production.

The sample's [`appsettings.json`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/appsettings.json) sets `Cratis:Arc:Development` to `true`. Development mode is for a local machine; do not enable it on an exposed host. [Configuration](../configuration/index.md) lists every setting.

To serve the same artifacts from Express, Fastify, or Hono instead of the standalone host, you keep the builder and hand its routes to the framework's adapter; see the [hosting overview](../overview.md).

## Look at what the server describes

A running Arc application describes itself. `GET /.cratis/commands` and `GET /.cratis/queries` list every operation with its route and the JSON Schema of its input, and `GET /openapi.json` returns an OpenAPI 3.1 document:

```bash
curl http://127.0.0.1:3000/.cratis/commands
```

The first entry names `RegisterTask`, its route, and a schema that requires `id` as a UUID and `title` as a string. [Introspection](../introspection/index.md) and [OpenAPI](../open-api/index.md) cover both.

## Recap

You started a server with no routing code. A command registered a task, Arc refused an empty title with a message for the right field, a query returned the stored task, and paging and sorting came for free. The entry point is six statements, and `build()` checked the wiring before the server accepted a request.

## If you know Arc on .NET

The concepts carry over; the spelling is TypeScript:

| Arc on .NET | Arc for TypeScript |
| --- | --- |
| `ArcApplication.CreateBuilder(args)` | `ArcApplication.createBuilder()` |
| `[Command]` record with `Handle()` | `@command()` class with `handle()` |
| `[ReadModel]` record with static query methods | `@readModel()` class with static `@query()` methods |
| Assembly discovery | `builder.discover(folderUrl)` or `builder.add(...)` |
| `app.UseCratisArc()` and `RunAsync()` | `app.run()` on the standalone host, or a framework adapter |

[Coming from Express and NestJS](../coming-from-express-and-nestjs.md) compares Arc with the Node.js code you may write today.

## Next step

Open the sample and read it file by file in [Your first command](your-first-command.md). After that, [Continue in the browser](continue-in-the-browser.md) generates a typed client and calls this server from a React page.
