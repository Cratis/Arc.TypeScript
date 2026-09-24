---
title: Arc for TypeScript
description: Arc for TypeScript brings the Arc CQRS server model - model-bound commands, read models, validation, and authorization - to Node.js, speaking the same HTTP contract as Arc on .NET.
---

Arc for TypeScript is a Node.js server implementation of [Arc](/arc/), the Cratis CQRS framework: you declare commands and read models as decorated classes, and Arc hosts them behind one HTTP contract that the existing Arc clients already understand.

Without it, a Node.js backend for an Arc frontend means writing every route, request parser, validation response, and status code by hand, then keeping all of it in step with the frontend. With it, commands and queries run through one pipeline that owns those concerns, the wire behavior follows Arc on .NET, and the proxy generator writes the typed frontend client from your source.

:::caution[Source preview, no full parity]
No package is published to npm; the manifests are at version 0.17.0 for a source preview. Arc for TypeScript does **not** have full parity with Arc on .NET, and package names and APIs can still change. The [capability reference](reference/capabilities.md) is the single place for status and evidence.
:::

## What it looks like

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

These excerpts are from the [Tasks sample](https://github.com/Cratis/Arc.TypeScript/tree/main/Samples/Tasks). The sample serves them at `POST /api/tasks/registration/register-task` and `GET /api/tasks/listing/all-tasks`, with no routing code. [Get started](getting-started/index.md) runs it in a few commands.

## What you get

- **Model-bound commands and read models** with typed fields, concepts, `provide()`, [command context](commands/command-context.md), [response value handlers](commands/response-value-handlers.md), and [operations](commands/operations/index.md) that Arc executes and compensates.
- **Validation** with `CommandValidator`, `QueryValidator`, and `ConceptValidator` rules, and a `/validate` route for every command.
- **Queries** with argument binding, paging and sorting, [renderers and interceptors](queries/query-pipeline.md), and [observable queries](queries/observable-queries.md) over server-sent events, WebSockets, and multiplexed hubs.
- **Security**: [authentication handlers](core/authentication.md) including JWT bearer and EasyAuth, [roles and policies](authorizing-commands-and-queries.md), [identity details](identity/index.md), and [tenancy](tenancy/index.md).
- **Hosting** on Node's own HTTP server, or in [Express, Fastify, or Hono](hosts/index.md).
- **Generated proxies** for the published `@cratis/arc` client, read from your TypeScript source by [`arc-proxygenerator`](proxy-generation/index.md).
- **Testing** through the real pipelines with [scenarios](testing/index.md), and **ESLint rules** that catch binding mistakes in the editor with [code analysis](code-analysis/index.md).
- **Optional integrations**: [MongoDB](mongodb/index.md), [SQL with Drizzle](sql/index.md), [OpenTelemetry observability](observability.md), and the experimental [Chronicle](chronicle/index.md) event store.

## CQRS first, event sourcing optional

Arc is a CQRS framework. A command can validate input, call a service, write to current-state storage, and return a response without any event log. The core has no dependency on event sourcing or on a database. The Chronicle integration is a separate package: experimental, and not private since v0.12.0; see [CQRS without event sourcing](/arc/arc-without-event-sourcing/) for how that boundary works in Arc generally.

## A server for the clients you already have

Arc's TypeScript **client** packages, `@cratis/arc`, `@cratis/arc.react`, and `@cratis/arc.react.mvvm`, are built and released from the [Arc repository](https://github.com/Cratis/Arc). This project does not replace, rename, or republish them; they are its compatibility target. The server packages are listed in [Packages](reference/packages.md). See [Frontend](/arc/frontend/) for the client side.

## One wire contract

Arc on .NET is the reference implementation, and the language-neutral [Arc HTTP contract](/arc/http-contract/) is the specification. Arc for TypeScript matches that observable behavior in idiomatic TypeScript; it does not port .NET mechanics such as attribute reflection or dependency injection containers. A paired suite checks 57 cases against a .NET host on `Cratis.Arc` 22.23.0 and pins the known differences. The largest deliberate one: an HTTP client cannot use `X-Allowed-Severity: 3` to let error-severity validation results pass. See the [HTTP contract reference](reference/http-contract.md).

## On the shared Arc pages

The shared Arc pages, such as the [tutorial](/arc/tutorial/first-slice/) and the scenarios, show a TypeScript tab beside C#, Kotlin, and Java. The TypeScript snippets use the model-bound API and are compiled against this repository's packages. Read them with these differences in mind:

- Repositories and catalogs in the snippets, such as `AuthorRepository`, are application-owned abstract classes that you implement and register with `builder.services`. An abstract class serves as its own service token; an interface does not exist at runtime.
- An observable query declares `@query({ observable: true }, ...)` in addition to returning an observable source.
- In the snippets, `provide()` takes no parameters: it resolves services with `currentServices()` and reads the request's cancellation signal from `currentContext()`. You can also declare its parameters with `@inject(...)`, as [Model-bound commands](commands/model-bound/index.md#prepare-data-in-provide) shows.
- Where a page covers something Arc for TypeScript does not do yet, such as injecting read models into validators or seeding Chronicle events in a scenario, the tab says so instead of showing code.
- Proxy generation on those pages describes the C# and JVM generators. Arc for TypeScript generates the same kind of proxies from TypeScript source; [Proxy generation](proxy-generation/index.md) lists what differs.

## Releases

Arc for TypeScript is versioned independently of Arc on .NET. GitHub source previews are available; npm publication is disabled. A major release is never made automatically: it requires verified full parity with Arc on .NET and an explicit merge by a maintainer. See [Preview a TypeScript release](contributing/releases.md).

## Where to go next

- [Get started](getting-started/index.md): run the Tasks sample and call its command and query.
- [Coming from Express and NestJS](coming-from-express-and-nestjs.md): compare Arc with the code you write today.
- [Hosting overview](overview.md): choose the standalone host or a framework adapter.
- [Architecture](architecture.md): the core, the adapters, and how Arc concepts map to TypeScript.
- [Troubleshooting](troubleshooting.md): fixes for the common decorator, discovery, and hosting problems.
