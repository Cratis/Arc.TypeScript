# Arc for TypeScript

**The [Arc](https://github.com/Cratis/Arc) CQRS server for Node.js: define commands and queries in TypeScript and serve them over the same HTTP contract as Arc on .NET.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1182595891576717413?label=Discord&logo=discord&logoColor=white)](https://discord.gg/kt4AMpV8WV)

> [!IMPORTANT]
> **Early source preview; npm packages are not published.** This repository contains the server core, adapters for Express, Fastify, and Hono, optional tenant-scoped MongoDB collections and Drizzle SQL queries, a bounded source-based client generator, and an experimental Chronicle integration. No package is published to npm, and Arc for TypeScript does **not** have full parity with Arc on .NET. APIs and package names can still change. Check the [capability reference](Documentation/reference/capabilities.md) before you design around a feature.

Arc is an opinionated CQRS application framework. You declare what your backend can do as commands and queries, and Arc handles routing, input binding, validation, authorization, correlation, tenancy, and the result envelope that Arc clients expect. Arc for TypeScript brings that model to Node.js as idiomatic TypeScript, not as a line-by-line port.

## A command and a query

In the [Tasks sample](Samples/Tasks/main.ts), a command is a class with fields and a `handle` method; a query is a static method on a read model. These excerpts use `TaskId`, `TaskTitle`, and `Tasks` from that sample:

```typescript
@command()
export class RegisterTask {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @inject(Tasks)
    handle(tasks: Tasks): TaskId {
        tasks.register(this.id, this.title);
        return this.id;
    }
}

@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }
}
```

`@field` comes from `@cratis/fundamentals`; the other decorators come from `@cratis/arc.core`. Arc decodes the fields into concepts, runs the command or query in a service scope, and uses that same field metadata for JSON Schema. The sample discovers artifacts under `Features/`, so these routes are `POST /api/tasks/registration/register-task` and `GET /api/tasks/listing/all-tasks`. Start with [Get started](Documentation/getting-started.md) for a complete build and two HTTP calls. If you need explicit Zod schemas and low-level handler callbacks instead, use the existing `defineCommand` and `defineQuery` APIs; they remain supported.

## Packages

| Package | Folder | Contents |
| --- | --- | --- |
| `@cratis/arc.core` | [`Source/Core`](Source/Core) | `ArcApplication`, the `@command`, `@readModel`, `@query` and authorization decorators, `CommandValidator`, `QueryValidator`, `ConceptValidator` and `ModelValidator`, `ArcServer`, `defineCommand`, `defineQuery`, the command and query pipelines, explicit services, authentication handlers, identity details, tenancy, results, introspection, OpenAPI, `exportClientManifest`, and the standalone Node host (`createArcNodeHandler`, `runArc`) with public static files and SPA fallback. |
| `@cratis/arc.express` | [`Source/Express`](Source/Express) | `mountExpress` for Express 5 |
| `@cratis/arc.fastify` | [`Source/Fastify`](Source/Fastify) | `mountFastify` for Fastify 5 |
| `@cratis/arc.hono` | [`Source/Hono`](Source/Hono) | `mountHono` for Hono 4 |
| `@cratis/arc.testing` | [`Source/Testing`](Source/Testing) | `CommandScenario`, `QueryScenario`, and `ObservableQueryScenario` for decorated artifacts; `ArcScenario` for low-level definitions and HTTP |
| `@cratis/arc.proxygenerator` | [`Source/Tools/ProxyGenerator`](Source/Tools/ProxyGenerator) | `analyzeSource`, `renderSource`, `generateFromSource`, and the `arc-proxygenerator` CLI generate published-client proxies from decorated source. The original `renderClientManifest`/`generateClient` JSON path remains available for low-level definitions. See [Generate command and query clients](Documentation/guides/generate-clients.md). |
| `@cratis/eslint-plugin-arc-core` | [`Source/CodeAnalysis`](Source/CodeAnalysis) | ESLint 10 flat-config diagnostics for model-bound server artifacts, with an untyped-safe recommended config and an optional type-checked preset. See [Code analysis](Documentation/code-analysis/index.md). |
| `@cratis/arc.mongodb` | [`Source/MongoDB`](Source/MongoDB) | `builder.addMongoDB`, tenant-scoped model collections with BSON mapping and replica-set observation, plus the existing `MongoReadModels` helper; uses the `mongodb` 6 driver |
| `@cratis/arc.drizzle` | [`Source/Drizzle`](Source/Drizzle) | `builder.addDrizzle`, tenant-scoped SQL handles, explicit column codecs and provider-owned paging; SQLite and PostgreSQL tested, MySQL and observation unverified |
| `@cratis/arc.chronicle` | [`Source/Chronicle`](Source/Chronicle) | **Experimental.** `builder.addChronicle` appends returned events and resolves registered read models by command key; nested command returns join one event-log batch. In-memory command assertions are available under `@cratis/arc.chronicle/testing`. SDK 6.5.1 imports natively; an opt-in kernel suite exercises all three HTTP adapters. No .NET transaction, aggregate, or reactor-command parity. |

Every package manifest is at version 0.13.0. That is the version of this source preview, not an npm release, and the Chronicle package is experimental. The packages ship ES modules only, and schemas use Zod 4. The core, host adapter, MongoDB, and Drizzle packages need Node.js 22 or later. The root workspace needs Node.js 22.19 or later, because it installs the Chronicle SDK; Node.js 24 LTS is recommended.

## Try it

Until the packages are published, run the sample from a clone:

```bash
git clone https://github.com/Cratis/Arc.TypeScript.git
cd Arc.TypeScript
corepack enable
yarn install
yarn build
yarn workspace @cratis/arc.core.sample.tasks start
```

The sample listens on port 3000 on loopback by default; Ctrl+C gracefully stops its `app.run()` lifecycle. [Get started](Documentation/getting-started.md) walks through calling it and explains every line.

## What works and what does not

Supported, with specs in this repository: commands and queries with Zod schemas, observable queries (HTTP snapshots, direct SSE and WebSocket, and the multiplexed WebSocket and SSE hubs used by the `@cratis/arc` client), validation-only requests, validators and filters, declared and per-request authorization, authentication handlers, correlation IDs, execution scopes, in-memory and provider paging, exception redaction, introspection, OpenAPI, the three host adapters, tenant-scoped MongoDB collections with live replica-set specs, and SQL paging with SQLite and PostgreSQL specs.

Also supported, each one explicit or opt-in:

- **Services.** Use `builder.services.addSingleton(Tasks)` for class self-binding, or register a factory or `serviceToken`; `@injectable(...)` and `static inject` declare constructor dependencies. Model-bound methods use `@inject(...)` and ordered `service(...)` query descriptors. The older `define*` definitions retain `handlerDependencies` and `validatorDependencies`. Execution scopes dispose their services; `await app.dispose()` closes the app and its registry.
- **Identity.** `identityDetails` (Zod schema or model-bound details type) or a discovered `@identityDetailsProvider()` registers `GET /.cratis/me` and sets a client-readable display cookie. The cookie is for display only; it is not a credential. [Identity and authentication](Documentation/identity/index.md) describes opt-in EasyAuth headers and signed JWT verification.
- **Host principals.** `nativePrincipal: true` accepts a principal your host framework has already verified, passed through an explicit adapter callback. It cannot be combined with Arc authentication handlers.
- **Tenancy.** Besides the tenant header and `resolveTenant`, the `tenancy` option selects ordered header, query, claim, fixed/development, or subdomain sources, with optional `required` and membership-claim checks. [Tenant resolvers](Documentation/tenancy/resolvers.md) describe the trust boundary.
- **Testing.** `@cratis/arc.testing` runs decorated commands, queries, and observable queries through real pipelines with scoped services and JSON wire round trips; `ArcScenario` still covers low-level definitions and HTTP. See [test real pipelines](Documentation/guides/services-and-testing.md#test-a-decorated-command).
- **Generated clients, bounded.** Run `arc-proxygenerator --project <tsconfig> --artifacts <folder> --output <existing-folder>` against decorated commands and read models. It reads the TypeScript program, not application startup, and generates command/query/observable classes, nested models and hooks. These compile with the published `@cratis/arc` and `@cratis/arc.react` 22.19.1 in strict Bundler mode with `skipLibCheck: false`; the model-bound command, query, paging, sorting and observable hub run against all three adapters. Extensionless imports are the default for Vite/Bundler; use `--js-import-specifiers` for compiled native Node ESM. The Tasks sample's cross-platform `generate-proxies` script generates and compiles this output in CI. `NodeNext` consumer compilation is not supported by those published declarations. For low-level `define*` definitions, keep using `exportClientManifest` and the positional JSON CLI, whose narrower contract excludes nested DTOs, React hooks and shared validation rules. See [Generate command and query clients](Documentation/guides/generate-clients.md).

A paired suite checks 48 bounded HTTP cases, including model-bound validation, acronym naming, enum and named-float JSON output, against Arc on .NET 22.22.0 and pins the known differences. That is not full parity.

Not implemented:

- Generated server artifact metadata and complete .NET proxy parity. The source analyzer emits a bounded client model, but standard-mode injection still needs explicit tokens; identity-only models and some .NET template options are not yet emitted. Literal client-safe `@validator(Target)` constructor rules and decorated derived classes are emitted, while server-only validation rules report diagnostics.
- SQL observation and automatic migration execution. [Drizzle SQL](Documentation/sql/index.md) supports explicit conversions and SQL paging but not EF change tracking or cross-process notifications. Named policies and guarded identity handlers are supported; see [authorization](Documentation/identity/authorization.md). Command operations and effects have a bounded implementation, not a distributed transaction.

The Chronicle integration stays experimental despite passing a bounded live-kernel suite. SDK 6.5.1 handles literal JSON `null` for a missing model, which the suite checks across all three adapters. Command-key read-model injection and a single-event-log nested returned-event batch exist; returned events and command operations cannot be combined. Immediate appends, aggregates, and reactor command effects do not join that batch.

The [capability reference](Documentation/reference/capabilities.md) lists every Arc feature family, its status, and the deliberate differences from Arc on .NET.

## Documentation

- [Get started](Documentation/getting-started.md): run the model-bound Tasks sample and call its command and query.
- [Commands](Documentation/guides/commands.md), [read models and queries](Documentation/guides/read-models-and-queries.md), [concepts](Documentation/guides/concepts.md), [dependency injection](Documentation/guides/dependency-injection.md), and [application setup](Documentation/guides/application-setup.md).
- [Host Arc in Express, Fastify, or Hono](Documentation/guides/host-integration.md)
- [Host Arc directly in Node.js](Documentation/guides/standalone-host.md)
- [Call Arc from code](Documentation/guides/direct-calls.md)
- [Validate model-bound commands and queries](Documentation/guides/validation.md)
- [Validate and authorize commands and queries](Documentation/guides/validation-and-authorization.md)
- [Identity and authentication](Documentation/identity/index.md), [authorization policies](Documentation/identity/authorization.md), [tenant resolvers](Documentation/tenancy/resolvers.md)
- [Decide command outcomes](Documentation/guides/command-outcomes.md)
- [Bind query arguments, page, and sort](Documentation/guides/queries.md)
- [Configure the server](Documentation/guides/configuration.md)
- [Observe Arc requests](Documentation/observability.md) with an application-owned OpenTelemetry SDK
- [Render provider queries](Documentation/queries/renderers.md) and [intercept read models](Documentation/queries/read-model-interception.md)
- [Model-bound JSON wire format](Documentation/queries/wire-format.md) for derived types, acronyms and named floats
- [Compose services and test pipelines](Documentation/guides/services-and-testing.md)
- [Read models from MongoDB](Documentation/guides/mongodb.md)
- [Read models from SQL with Drizzle](Documentation/sql/index.md)
- [Generate command and query clients](Documentation/guides/generate-clients.md)
- [Append Chronicle events from commands (experimental)](Documentation/guides/chronicle.md)
- [Capability reference](Documentation/reference/capabilities.md)
- [Architecture](Documentation/explanation/architecture.md)
- [Arc HTTP contract](https://github.com/Cratis/Arc/blob/main/Documentation/http-contract.md): the wire protocol every Arc backend speaks.

## Relationship to `@cratis/arc`

[`@cratis/arc`](https://github.com/Cratis/Arc/tree/main/Source/JavaScript/Arc) is Arc's existing TypeScript **client** runtime, used by generated proxies and `@cratis/arc.react` to call an Arc backend. It is built and released from the [Arc](https://github.com/Cratis/Arc) repository.

This repository builds the **server** side under its own `@cratis/arc.core` package names. It does not replace, rename, or republish `@cratis/arc` or any other Arc package. The existing client is the compatibility target for this server's wire behavior. The server core does not depend on `@cratis/arc` or on browser code; only the proxies that `@cratis/arc.proxygenerator` writes import it, in your frontend.

## Arc does not require event sourcing

Arc is a CQRS framework first. A command can validate input, call a service, write to current-state storage, and return a response without an event log, and the server core has no dependency on event sourcing or a database. Event sourcing comes from [Chronicle](https://github.com/Cratis/Chronicle) as an optional integration. Here that integration is experimental: the pinned [Chronicle TypeScript client](https://github.com/Cratis/Chronicle.TypeScript) 6.5.1 loads in native Node.js and a bounded suite passes against a live kernel for existing-model resolution and returned-event batches, but the integration does not yet match Arc on .NET's full transactions or aggregate/reactor behavior.

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
