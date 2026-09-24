---
title: Get started with Arc for TypeScript
description: Build the repository, run the Tasks sample, call its command and query over HTTP, and see how a Zod schema, a validator, and a handler become an Arc endpoint.
---

A Node.js backend for an Arc frontend usually starts with a pile of hand-written routes, each one parsing JSON, checking input, choosing a status code, and shaping a response the generated Arc client can read. Arc for TypeScript replaces that pile with two definitions: a command that changes something and a query that reads something. The server derives the routes, runs validation and authorization in a fixed order, and answers with the same result envelope Arc on .NET uses.

By the end of this page you have the Tasks sample running on your machine, you have created and listed tasks over HTTP, and you know what each line of the sample does.

:::caution[Unpublished early source]
No Arc for TypeScript package is published to npm yet, so you work inside a clone of the repository. The implementation does not have full parity with Arc on .NET, and APIs and package names can still change. Check the [capability reference](reference/capabilities.md) before you rely on a feature.
:::

## What you need

- Node.js 22.19 or later; Node.js 24 LTS is recommended. The core and adapter packages need Node.js 22, but the root workspace declares 22.19 or later because it installs the Chronicle SDK. The packages are ES modules only.
- Git and `curl`.
- Corepack, which selects the Yarn version the repository pins. If `corepack` is not available with your Node.js installation, install it with `npm install --global corepack`.

## Build the repository

Clone the repository and build every workspace:

```bash
git clone https://github.com/Cratis/Arc.TypeScript.git
cd Arc.TypeScript
corepack enable
yarn install
yarn build
```

`yarn install` links the workspaces together, so the sample imports `@cratis/arc.core` and `@cratis/arc.hono` from the `Source/Arc.Core` and `Source/Hono` folders instead of from npm. `yarn build` runs the TypeScript compiler over the core, the host adapters, the optional integrations, and the sample.

## Start the Tasks sample

```bash
yarn workspace @cratis/arc.core.sample.tasks start
```

The sample serves HTTP on port 3000. Set the `PORT` environment variable to use another port. Leave it running and open a second terminal for the next steps.

:::caution[The sample listens on every network interface]
The sample does not set a host name, so other machines on your network can reach port 3000. Run it only on a machine and network you trust, and stop it with Ctrl+C when you are done. It keeps tasks in memory, so every restart starts from an empty list.
:::

## Create a task

Send the `Tasks.Create` command:

```bash
curl -X POST http://localhost:3000/api/tasks/create \
  -H 'content-type: application/json' \
  -d '{"id":"t1","title":"Write the getting started guide"}'
```

The response is an Arc command result. It is shown formatted here; your correlation ID is different:

```json
{
  "correlationId": "7dbd5bd5-a277-4bd7-bf9b-d6eeb2c3f9d0", "isAuthorized": true,
  "validationResults": [], "exceptionMessages": [], "exceptionStackTrace": "",
  "authorizationFailureReason": "", "isValid": true, "hasExceptions": false,
  "isSuccess": true, "response": { "id": "t1" }
}
```

The status code is 200. The same correlation ID comes back in the `X-Correlation-ID` response header. Send a valid UUID in that header and the server reuses it; otherwise it creates one.

## List the tasks

Call the `Tasks.List` query with GET:

```bash
curl http://localhost:3000/api/tasks/list
```

```json
{
  "correlationId": "1fd321c6-ee4f-4c99-ab7e-8e67c5115267", "isReady": true, "isAuthorized": true,
  "validationResults": [], "exceptionMessages": [], "exceptionStackTrace": "",
  "paging": { "page": 0, "size": 0, "totalItems": 0, "totalPages": 0 },
  "isValid": true, "hasExceptions": false, "isSuccess": true,
  "data": [{ "id": "t1", "title": "Write the getting started guide" }]
}
```

Query arguments travel in the query string, and `page` and `pageSize` ask the server to page the result:

```bash
curl 'http://localhost:3000/api/tasks/list?search=guide&pageSize=10'
```

This time `paging` reports `{ "page": 0, "size": 10, "totalItems": 1, "totalPages": 1 }`. A query also accepts the HTTP `QUERY` method with a JSON body, which the server answers with `Cache-Control: no-store`:

```bash
curl -X QUERY http://localhost:3000/api/tasks/list \
  -H 'content-type: application/json' \
  -d '{"arguments":{"search":"guide"},"paging":{"page":0,"pageSize":10}}'
```

In a `QUERY` body, `pageSize: 0` asks for the whole result; in a GET query string, `pageSize` must be at least 1.

## See validation reject a command

Send a title that is only whitespace:

```bash
curl -X POST http://localhost:3000/api/tasks/create \
  -H 'content-type: application/json' \
  -d '{"id":"t2","title":"   "}'
```

The status code is 400, `isSuccess` is `false`, no task is stored, and `validationResults` names the member that failed:

```json
[{ "severity": 3, "message": "A title is required", "members": ["title"], "reason": "rule" }]
```

Now leave out the title entirely:

```bash
curl -X POST http://localhost:3000/api/tasks/create \
  -H 'content-type: application/json' \
  -d '{"id":"t2"}'
```

This is also a 400, but the single validation result has the reason `malformedRequest` and no members. The two failures come from different places in the sample, which the next section shows.

To check input without running the handler, post to the command's `/validate` route. It returns 200 with no `response`, and nothing is stored:

```bash
curl -X POST http://localhost:3000/api/tasks/create/validate \
  -H 'content-type: application/json' \
  -d '{"id":"t3","title":"Plan the release"}'
```

## Read the sample

The sample is two files. [`Samples/Tasks/src/TaskRepository.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/src/TaskRepository.ts) stores the tasks:

```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Demo-only in-memory storage; use a durable store for a real application. */
export class TaskRepository {
    readonly #tasks = new Map<string, string>();
    save(id: string, title: string): void { this.#tasks.set(id, title); }
    list(search: string): { id: string; title: string }[] {
        return [...this.#tasks].filter(([, title]) => title.includes(search)).map(([id, title]) => ({ id, title }));
    }
}
```

[`Samples/Tasks/src/index.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/src/index.ts) defines the command and the query and starts the server:

```typescript
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer, currentServices, defineCommand, defineQuery, serviceToken, validation } from '@cratis/arc.core';
import { TaskRepository } from './TaskRepository.js';
import { mountHono } from '@cratis/arc.hono';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repository = serviceToken<TaskRepository>('tasks repository');
const create = defineCommand({
    name: 'Create', namespace: 'Tasks', schema: z.object({ id: z.string(), title: z.string() }),
    validate: ({ title }) => title.trim() ? [] : [validation('A title is required', ['title'])],
    handlerDependencies: [repository],
    handle: async ({ id, title }) => { (await currentServices().resolve(repository)).save(id, title); return { id }; }
});
const list = defineQuery({
    name: 'List', namespace: 'Tasks', schema: z.object({ search: z.string().default('') }),
    handlerDependencies: [repository],
    perform: async ({ search }) => (await currentServices().resolve(repository)).list(search)
});
export const server = new ArcServer({ commands: [create], queries: [list], services: [
    { token: repository, lifetime: 'singleton', factory: () => new TaskRepository() }
] });
export const app = new Hono();
mountHono(app, server);
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
    serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
}
```

Here is what each part does.

### The schema is the contract that exists at runtime

TypeScript types are erased when the code is compiled, so at runtime there is no `{ id: string; title: string }` type left to check a request against. The Zod schema is what survives. Arc uses it three ways:

- It parses every incoming body or argument set with the schema. Input that does not match, such as the missing `title`, is rejected as `malformedRequest` before your code runs. With `z.object`, properties the schema does not declare are dropped.
- The handler's input type is inferred from the schema, so `handle` receives a typed `{ id, title }` without a separate interface.
- It converts the schema to JSON Schema for the server's description endpoints.

The schema answers "is this the right shape?". It does not produce per-member messages. That is the job of `validate`.

### Validators express the rules

`validate` receives the parsed input and returns validation results. The `validation(message, members)` helper builds one with the reason `rule` and error severity. Returning an empty array means the input is valid. This is where the "A title is required" result came from.

### Handlers do the work

`handle` runs only after the schema and every validator accept the input. The value it returns becomes `response` in the command result. It can be `async` and return a promise, as it is here.

A query's `perform` works the same way and returns the data. When it returns an array, the server applies `page` and `pageSize` to it in memory, which is why paging worked without any paging code in the sample.

### Services are registered and declared explicitly

The tasks live in one `TaskRepository` that both the command and the query use. `serviceToken<TaskRepository>('tasks repository')` creates a typed key for it, and the `services` option registers a factory for that key with the `singleton` lifetime, so the server creates one repository on first use and reuses it for every request.

Each definition lists the token in `handlerDependencies`. Before the handler runs, Arc checks that every declared token is registered and that the registrations have no cycles and no singleton that depends on a shorter-lived service. A missing registration fails the request with the reason `dependencyUnavailable` instead of calling your code. Inside `handle` and `perform`, `currentServices().resolve(repository)` returns the instance.

Nothing is discovered automatically, and Arc does not integrate with an application dependency injection container. A singleton belongs to the server's registry and is disposed by `await server.dispose()`; the sample does not call it, because it holds no resources. [Compose services and test pipelines](guides/services-and-testing.md) covers scoped and transient lifetimes, disposal, and testing.

### Names become routes

The route comes from the namespace and the name: `Tasks` and `Create` become `/api/tasks/create`, and `Tasks` and `List` become `/api/tasks/list`. Commands accept POST, queries accept GET and `QUERY`, and any other method gets a 405 with an `Allow` header. [Configure the server](guides/configuration.md) shows how to change the prefix or set an explicit path.

### You register every definition

`new ArcServer({ commands: [create], queries: [list] })` is the complete list of what the server serves. Arc on .NET discovers commands and queries by scanning compiled types. Arc for TypeScript implements neither that discovery nor TypeScript proxy generation: a definition you do not pass to `ArcServer` does not exist for clients.

### The host adapter connects a web framework

`ArcServer` does not listen on a port. `mountHono` installs it as Hono middleware: requests for Arc routes are answered by Arc, and everything else falls through to your own Hono routes. `serve` from `@hono/node-server` then runs the Hono app on Node.js, but only when this file is the program's entry point. The check resolves symbolic links in the start path, so it also holds when the file is started through a linked workspace, and importing the module, for example from a spec, does not start a server. Express and Fastify have matching adapters.

## See what the server describes

The server describes its commands and queries, including the JSON Schema generated from each Zod schema:

```bash
curl http://localhost:3000/.cratis/commands
curl http://localhost:3000/.cratis/queries
curl http://localhost:3000/openapi.json
```

These endpoints answer GET requests without authentication.

## Next steps

The pattern is always the same: define an operation with a Zod schema, add validators and a handler, register it with `ArcServer`, and mount the server in a host framework.

- [Host Arc in Express, Fastify, or Hono](guides/host-integration.md) to put these definitions behind the framework you already use.
- [Validate and authorize commands and queries](guides/validation-and-authorization.md) to add authentication, roles, and business rules, and to see the order in which they run.
- [Bind query arguments, page, and sort](guides/queries.md) for GET and `QUERY` arguments and for paging in a database.
- [Configure the server](guides/configuration.md) for routes, tenancy, body limits, and error handling.
- [Compose services and test pipelines](guides/services-and-testing.md) for service lifetimes, disposal, and specs that run the real pipelines.
- [Architecture](explanation/architecture.md) for how the core, the adapters, and optional integrations fit together.
