---
title: Arc for TypeScript
description: Arc for TypeScript brings the Arc CQRS server model - commands, queries, validation, and authorization - to Node.js, speaking the same HTTP contract as Arc on .NET.
---

Arc for TypeScript is a Node.js server implementation of [Arc](/arc/), the Cratis CQRS framework: you declare commands and queries, and Arc hosts them behind one HTTP contract that the existing Arc clients already understand.

Without it, a Node.js backend for an Arc frontend means writing every route, request parser, validation response, and status code by hand, and then keeping all of it in step with what the generated TypeScript clients expect. With it, commands and queries run through one pipeline that owns those concerns, so the wire behavior follows Arc on .NET instead of being re-invented per endpoint.

:::caution[Unpublished, without full parity]
Arc for TypeScript is not ready for production use. No package is published to npm, and npm publication is not configured. The package manifests are at version 0.13.0 for a source preview, not an npm release. Parity with Arc on .NET is **not** achieved: command keys and read models resolved into handlers are not implemented, client generation covers only explicitly declared low-level shapes and not model-bound commands and queries, and the Chronicle integration is private and unverified against a live kernel. The [capability reference](reference/capabilities.md) lists what is supported. Package names and APIs can still change.
:::

## What the server core provides

Beyond the command and query pipelines, the core offers these explicit or opt-in features:

- **Services.** Register a class or a `serviceToken` with a `singleton`, `scoped`, or `transient` lifetime, and declare the services a command, query, or validator needs. Classes decorated with `@singleton()`, `@scoped()`, or `@transient()` register themselves when you discover or add them. Arc creates and disposes a scope per call, and disposes singletons when you dispose the application, or the `ServiceRegistry` you passed in. There is no integration with another dependency injection container. See [Register model-bound services](guides/dependency-injection.md) and [Compose services and test pipelines](guides/services-and-testing.md).
- **Identity details.** The `identityDetails` option registers `/.cratis/me`, which sets a client-readable display cookie. That cookie is not a credential.
- **Host principals.** `nativePrincipal: true` accepts a principal your host framework already verified, through an explicit adapter callback, instead of Arc authentication handlers.
- **Tenancy.** The `tenancy` option adds ordered header, query, claim, fixed, and subdomain sources, with optional required-tenant and membership checks.
- **Testing.** The `@cratis/arc.testing` package runs specs through the real command, query, and HTTP pipelines.
- **Generated proxies.** `arc-proxygenerator` reads your TypeScript project, finds the `@command()` and `@readModel()` artifacts below your artifacts folder, and writes typed proxies and React hooks for the published `@cratis/arc` client, including the client-safe validation rules, with the same routes the server serves. For schema-first `define*` operations, `exportClientManifest` writes a JSON contract from explicit `clientOutput` shapes instead. See [Generate command and query clients](guides/generate-clients.md).

## A server for the clients you already have

Arc's TypeScript **client** packages already exist. They are built and released from the [Arc repository](https://github.com/Cratis/Arc), and this project does not replace, rename, or republish them.

| Package | Role | Where it comes from |
| --- | --- | --- |
| `@cratis/arc` | Client runtime for commands, queries, validation, identity, and observable queries | Arc repository, published to npm |
| `@cratis/arc.react`, `@cratis/arc.react.mvvm` | React bindings and MVVM support on top of the client | Arc repository, published to npm |
| `@cratis/arc.core` | Server core: pipelines, routing, results, and cross-cutting concerns | This repository, unpublished |
| `@cratis/arc.express`, `.fastify`, `.hono` | Host adapters that connect the core to a Node.js HTTP framework | This repository, unpublished |
| `@cratis/arc.proxygenerator` | Generator and `arc-proxygenerator` CLI that write `@cratis/arc` proxies from your TypeScript source or from an exported client manifest | This repository, unpublished |
| `@cratis/arc.mongodb` | Optional tenant-aware MongoDB read helper | This repository, unpublished |
| `@cratis/arc.chronicle` | Experimental Chronicle event append for commands | This repository, private, not published |

The client packages are the compatibility target. A frontend should work against an Arc for TypeScript backend for the capabilities marked supported, within the [deliberate differences](reference/capabilities.md#deliberate-differences). See [Frontend](/arc/frontend/) for the client side.

## One wire contract

Arc on .NET is the reference implementation, and the language-neutral [Arc HTTP contract](/arc/http-contract/) is the specification: routes, methods, headers, result envelopes, status codes, identity, and validation values. Arc for TypeScript matches that observable behavior in idiomatic TypeScript. It does not port .NET mechanics such as attribute reflection or dependency injection containers.

A paired suite checks a bounded set of routes against a .NET host built on `Cratis.Arc` 22.22.0 and pins the known differences. The largest deliberate one is that an HTTP client cannot use `X-Allowed-Severity: 3` to let error-severity validation results pass.

## CQRS first, event sourcing optional

Arc is a CQRS framework. A command can validate input, call a service, write to current-state storage, and return a response without any event log. The server core has no dependency on event sourcing or on a database.

Two integrations are separate packages. [MongoDB](guides/mongodb.md) is an optional read helper for queries. [Chronicle](guides/chronicle.md) is experimental: the pinned Chronicle TypeScript SDK 6.2.0 does not load in native Node.js, and the adapter has not been verified against a live kernel. The SDK itself is developed in the [Chronicle TypeScript client](https://github.com/Cratis/Chronicle.TypeScript) repository. See [CQRS without event sourcing](/arc/arc-without-event-sourcing/) for how the boundary works in Arc generally.

## Host frameworks

The core does not own an HTTP server. Host adapters for [Express](https://expressjs.com) 5, [Fastify](https://fastify.dev) 5, and [Hono](https://hono.dev) 4 connect it to the framework you already use. The [architecture](explanation/architecture.md) explains what the core owns and what each adapter owns.

## On the shared Arc pages

The shared Arc pages, such as the [tutorial](/arc/tutorial/first-slice/) and the scenarios, show a TypeScript tab beside C#, Kotlin, and Java wherever they show backend code. The TypeScript snippets use the model-bound API and are compiled against this repository's packages. Read them with these differences in mind:

- Repositories and catalogs in the snippets, such as `AuthorRepository`, are application-owned abstract classes that you implement and register with `builder.services`. An abstract class serves as its own service token; an interface does not exist at runtime.
- An observable query declares `@query({ observable: true }, ...)` in addition to returning an observable source.
- `provide()` takes no parameters. It resolves services with `currentServices()` and reads the request's cancellation signal from `currentContext()`, as [Define model-bound commands](guides/commands.md) describes.
- Where a page covers something Arc for TypeScript does not do yet, the tab says so instead of showing code. That applies to resolving a read model by command key into a handler or validator, and to the Chronicle integration's event appends and test seeding.
- Proxy generation on those pages describes the C# and JVM generators. Arc for TypeScript generates the same kind of proxies from your TypeScript source with `arc-proxygenerator`; [Generate command and query clients](guides/generate-clients.md) lists what differs.

## Releases

Arc for TypeScript is versioned independently of Arc on .NET. GitHub source previews are available; npm publication remains disabled. A major release is never made automatically: it requires verified full parity with Arc on .NET and an explicit merge by a maintainer. See [Preview a TypeScript release](contributing/releases.md).

## Where to go next

- [Get started](getting-started.md): run the Tasks sample and read it line by line.
- [Guides](guides/index.md): host, call, validate, query, configure, compose services, test, and persist.
- [Generate command and query clients](guides/generate-clients.md): generate typed proxies for the published `@cratis/arc` client from your TypeScript source.
- [Architecture](explanation/architecture.md): the standalone CQRS boundary, the core and host adapters, and how Arc concepts map to TypeScript.
- [Capability reference](reference/capabilities.md): each Arc feature family, its status here, and the deliberate differences.
- [Arc HTTP contract](/arc/http-contract/): the wire protocol every Arc backend speaks.
