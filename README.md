# Arc for TypeScript

**The [Arc](https://github.com/Cratis/Arc) CQRS server for Node.js: define commands and queries in TypeScript and serve them over the same HTTP contract as Arc on .NET.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1182595891576717413?label=Discord&logo=discord&logoColor=white)](https://discord.gg/kt4AMpV8WV)

> [!IMPORTANT]
> **Early source preview; npm packages are not published.** This repository contains the server core, adapters for Express, Fastify, and Hono, an optional MongoDB read helper, a bounded client generator, and an experimental, private Chronicle integration. No package is published to npm, and Arc for TypeScript does **not** have full parity with Arc on .NET. APIs and package names can still change. Check the [capability reference](Documentation/reference/capabilities.md) before you design around a feature.

Arc is an opinionated CQRS application framework. You declare what your backend can do as commands and queries, and Arc handles routing, input binding, validation, authorization, correlation, tenancy, and the result envelope that Arc clients expect. Arc for TypeScript brings that model to Node.js as idiomatic TypeScript, not as a line-by-line port.

## A command and a query

```typescript
import { ArcServer, defineCommand, defineQuery, validation } from '@cratis/arc.server';
import { mountHono } from '@cratis/arc.server.hono';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const tasks = new Map<string, string>();
const create = defineCommand({
    name: 'Create', namespace: 'Tasks', schema: z.object({ id: z.string(), title: z.string() }),
    validate: ({ title }) => title.trim() ? [] : [validation('A title is required', ['title'])],
    handle: ({ id, title }) => { tasks.set(id, title); return { id }; }
});
const list = defineQuery({
    name: 'List', namespace: 'Tasks', schema: z.object({ search: z.string().default('') }),
    perform: ({ search }) => [...tasks].filter(([, title]) => title.includes(search)).map(([id, title]) => ({ id, title }))
});
export const server = new ArcServer({ commands: [create], queries: [list] });
export const app = new Hono();
mountHono(app, server);
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
    serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
}
```

This is a self-contained example, not a copy of the sample. It serves `POST /api/tasks/create`, `POST /api/tasks/create/validate`, and `GET` or `QUERY /api/tasks/list`. The [Tasks sample](Samples/Tasks/src/index.ts) serves the same routes but keeps its tasks in a singleton `TaskRepository` service that the handlers declare as a dependency; [Get started](Documentation/getting-started.md) shows its complete source. The Zod schema is the runtime contract: TypeScript types are erased at runtime, so Arc parses every request with the schema, infers the handler's input type from it, and publishes it as JSON Schema.

## Packages

| Package | Folder | Contents |
| --- | --- | --- |
| `@cratis/arc.server` | [`Source`](Source) | `ArcServer`, `defineCommand`, `defineQuery`, the command and query pipelines, explicit services, authentication handlers, identity details, tenancy, results, introspection, OpenAPI, and `exportClientManifest`. The `@cratis/arc.server/testing` export provides `ArcScenario` and `shouldHaveRuleFailure`. |
| `@cratis/arc.server.express` | [`Integrations/Express`](Integrations/Express) | `mountExpress` for Express 5 |
| `@cratis/arc.server.fastify` | [`Integrations/Fastify`](Integrations/Fastify) | `mountFastify` for Fastify 5 |
| `@cratis/arc.server.hono` | [`Integrations/Hono`](Integrations/Hono) | `mountHono` for Hono 4 |
| `@cratis/arc.server.node` | [`Integrations/Node`](Integrations/Node) | `createArcNodeHandler` and `runArc` for standalone Node HTTP/HTTPS hosting, public static files and SPA fallback |
| `@cratis/arc.server.codegen` | [`CodeGeneration`](CodeGeneration) | `renderClientManifest`, `generateClient`, and the `arc-server-codegen` CLI, which turn an exported JSON client manifest into `.proxy.ts` files for the published `@cratis/arc` client. Bounded to the shapes in [Generate command and query clients](Documentation/guides/generate-clients.md). |
| `@cratis/arc.server.mongodb` | [`Integrations/MongoDB`](Integrations/MongoDB) | `MongoReadModels`, an optional tenant-aware read helper for queries, for the `mongodb` 6 driver |
| `@cratis/arc.server.chronicle` | [`Integrations/Chronicle`](Integrations/Chronicle) | **Experimental and private.** `defineChronicleCommand`, which appends events returned from a command. The pinned Chronicle TypeScript SDK 6.2.0 does not load in native Node.js; this adapter has not been verified against a live kernel. |

Every package manifest is at version 0.3.0. That is the version of this source preview, not an npm release, and the Chronicle package stays private. The packages ship ES modules only, and schemas use Zod 4. The core, host adapter, and MongoDB packages need Node.js 22 or later. The root workspace needs Node.js 22.19 or later, because it installs the Chronicle SDK; Node.js 24 LTS is recommended.

## Try it

Until the packages are published, run the sample from a clone:

```bash
git clone https://github.com/Cratis/Arc.TypeScript.git
cd Arc.TypeScript
corepack enable
yarn install
yarn build
yarn workspace @cratis/arc.server.sample.tasks start
```

The sample listens on port 3000 on every network interface. [Get started](Documentation/getting-started.md) walks through calling it and explains every line.

## What works and what does not

Supported, with specs in this repository: commands and queries with Zod schemas, validation-only requests, validators and filters, declared and per-request authorization, authentication handlers, correlation IDs, execution scopes, in-memory and provider paging, exception redaction, introspection, OpenAPI, the three host adapters, and the MongoDB read helper.

Also supported, each one explicit or opt-in:

- **Services.** You register each service against a `serviceToken` as `singleton`, `scoped`, or `transient`, and a definition declares the tokens it needs in `handlerDependencies` or `validatorDependencies`. Arc creates a scope for every HTTP or direct call and disposes the services it created there; singletons are disposed by `await server.dispose()`, or by disposing a `ServiceRegistry` you passed in yourself. There is no automatic discovery and no integration with an application's dependency injection container.
- **Identity.** `identityDetails` registers `GET /.cratis/me` and sets a client-readable display cookie. The cookie is for display only; it is not a credential.
- **Host principals.** `nativePrincipal: true` accepts a principal your host framework has already verified, passed through an explicit adapter callback. It cannot be combined with Arc authentication handlers.
- **Tenancy.** Besides the tenant header and `resolveTenant`, the `tenancy` option selects ordered header, query, claim, fixed, or subdomain sources, with optional `required` and membership-claim checks.
- **Testing.** `@cratis/arc.server/testing` runs specs through the real command, query, and HTTP pipelines.
- **Generated clients, bounded.** Declare an explicit `clientOutput` shape on each command and query, export a version 1 JSON manifest with `exportClientManifest`, and generate `.proxy.ts` files from it. The CLI reads only that JSON, never your application, and takes an absolute manifest path and an existing absolute output directory. The proxies are tested against `@cratis/arc` 22.19.1, `@cratis/fundamentals` 7.19.3, and `rxjs` 7.8.2 in a strict `Bundler` frontend with `skipLibCheck: false`; consumers that compile with `NodeNext` are not supported, because the published declarations use extensionless imports. The client's default origin is empty, so call `setOrigin` with your server's origin on each instance. Zod defaults, transforms and refinements, nullable command fields, scalar query results, nested DTOs, observable queries, and React hooks are not generated. See [Generate command and query clients](Documentation/guides/generate-clients.md).

A paired suite checks 33 bounded HTTP cases against Arc on .NET 22.22.0 and pins the known differences. That is not full parity.

Not implemented:

- Observable queries over HTTP, server-sent events, or WebSocket.
- Discovery of commands and queries by convention. You register every definition with `ArcServer`, and client generation reads only the output shapes you declare, not a full type graph. It does not match Arc's .NET proxy generator.
- Named authorization policies, SQL integrations, command operations and effects, and observable query test scenarios.

The Chronicle integration stays experimental and private: the pinned Chronicle TypeScript SDK 6.2.0 does not load in native Node.js, and this adapter has not been verified against a Chronicle kernel.

The [capability reference](Documentation/reference/capabilities.md) lists every Arc feature family, its status, and the deliberate differences from Arc on .NET.

## Documentation

- [Get started](Documentation/getting-started.md): run the Tasks sample and read it line by line.
- [Host Arc in Express, Fastify, or Hono](Documentation/guides/host-integration.md)
- [Host Arc directly in Node.js](Documentation/guides/standalone-host.md)
- [Call Arc from code](Documentation/guides/direct-calls.md)
- [Validate and authorize commands and queries](Documentation/guides/validation-and-authorization.md)
- [Decide command outcomes](Documentation/guides/command-outcomes.md)
- [Bind query arguments, page, and sort](Documentation/guides/queries.md)
- [Configure the server](Documentation/guides/configuration.md)
- [Compose services and test pipelines](Documentation/guides/services-and-testing.md)
- [Read models from MongoDB](Documentation/guides/mongodb.md)
- [Generate command and query clients](Documentation/guides/generate-clients.md)
- [Append Chronicle events from commands (experimental)](Documentation/guides/chronicle.md)
- [Capability reference](Documentation/reference/capabilities.md)
- [Architecture](Documentation/explanation/architecture.md)
- [Arc HTTP contract](https://github.com/Cratis/Arc/blob/main/Documentation/http-contract.md): the wire protocol every Arc backend speaks.

## Relationship to `@cratis/arc`

[`@cratis/arc`](https://github.com/Cratis/Arc/tree/main/Source/JavaScript/Arc) is Arc's existing TypeScript **client** runtime, used by generated proxies and `@cratis/arc.react` to call an Arc backend. It is built and released from the [Arc](https://github.com/Cratis/Arc) repository.

This repository builds the **server** side under its own `@cratis/arc.server` package names. It does not replace, rename, or republish `@cratis/arc` or any other Arc package. The existing client is the compatibility target for this server's wire behavior. The server core does not depend on `@cratis/arc` or on browser code; only the proxies that `@cratis/arc.server.codegen` writes import it, in your frontend.

## Arc does not require event sourcing

Arc is a CQRS framework first. A command can validate input, call a service, write to current-state storage, and return a response without an event log, and the server core has no dependency on event sourcing or a database. Event sourcing comes from [Chronicle](https://github.com/Cratis/Chronicle) as an optional integration. Here that integration is experimental and private: the pinned [Chronicle TypeScript client](https://github.com/Cratis/Chronicle.TypeScript) 6.2.0 does not load in native Node.js, and this adapter has not been verified against a Chronicle kernel.

## Contributing

Arc for TypeScript is a framework library, not an application. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and start with an issue or a conversation on [Discord](https://discord.gg/kt4AMpV8WV) for anything larger than a small fix.

Report security issues privately, as described in [SECURITY.md](SECURITY.md).

## Community and repository

| Path | Destination |
| --- | --- |
| Questions and discussion | [Cratis Discord](https://discord.gg/kt4AMpV8WV) |
| Bugs and feature requests | [GitHub Issues](https://github.com/Cratis/Arc.TypeScript/issues) |
| Arc documentation | [www.cratis.io/arc](https://www.cratis.io/arc/) |
| Security reports | [SECURITY.md](SECURITY.md) |
| License | [MIT](LICENSE) |

## The Cratis ecosystem

This project is part of [Cratis](https://www.cratis.io): free, MIT-licensed tools for building event-sourced and CQRS applications.

- **[Arc](https://github.com/Cratis/Arc)**: the CQRS framework for ASP.NET Core, and home of the TypeScript client and React packages. [Docs](https://www.cratis.io/arc/)
- **[Arc for Kotlin and Java](https://github.com/Cratis/Arc.Kotlin)**: Arc on Spring Boot.
- **[Chronicle](https://github.com/Cratis/Chronicle)**: the event-sourcing database and runtime, with a [TypeScript client](https://github.com/Cratis/Chronicle.TypeScript). [Docs](https://www.cratis.io/chronicle/)
- **[Components](https://github.com/Cratis/Components)**: React components aligned with Arc patterns. [Docs](https://www.cratis.io/components/)
- **[Fundamentals](https://github.com/Cratis/Fundamentals)**: shared primitives for .NET and TypeScript.
- **[Samples](https://github.com/Cratis/Samples)**: runnable event sourcing and CQRS samples.
- **[AI](https://github.com/Cratis/AI)**: free AI skills and rules for building with the stack.
