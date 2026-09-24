---
title: Arc for TypeScript
description: Arc for TypeScript brings the Arc CQRS server model - commands, queries, validation, and authorization - to Node.js, speaking the same HTTP contract as Arc on .NET.
---

Arc for TypeScript is a Node.js server implementation of [Arc](/arc/), the Cratis CQRS framework: you declare commands and queries, and Arc hosts them behind one HTTP contract that the existing Arc clients already understand.

Without it, a Node.js backend for an Arc frontend means writing every route, request parser, validation response, and status code by hand, and then keeping all of it in step with what the generated TypeScript clients expect. With it, commands and queries run through one pipeline that owns those concerns, so the wire behavior follows Arc on .NET instead of being re-invented per endpoint.

:::caution[Unpublished, without full parity]
Arc for TypeScript is not ready for production use. No package is published to npm, and npm publication is not configured. The package manifests are at version 0.4.0 for a source preview, not an npm release. Parity with Arc on .NET is **not** achieved: discovery of commands and queries is not implemented, client generation covers only a bounded set of explicitly declared shapes, and the Chronicle integration is private and unverified against a live kernel. The [capability reference](reference/capabilities.md) lists what is supported. Package names and APIs can still change.
:::

## What the server core provides

Beyond the command and query pipelines, the core offers these explicit or opt-in features:

- **Services.** Register services against a `serviceToken` with a `singleton`, `scoped`, or `transient` lifetime, and declare the tokens a definition needs. Arc creates and disposes a scope per call, and disposes singletons when you dispose the server, or the `ServiceRegistry` you passed in. Nothing is discovered automatically, and there is no integration with an application's dependency injection container. See [Compose services and test pipelines](guides/services-and-testing.md).
- **Identity details.** The `identityDetails` option registers `/.cratis/me`, which sets a client-readable display cookie. That cookie is not a credential.
- **Host principals.** `nativePrincipal: true` accepts a principal your host framework already verified, through an explicit adapter callback, instead of Arc authentication handlers.
- **Tenancy.** The `tenancy` option adds ordered header, query, claim, fixed, and subdomain sources, with optional required-tenant and membership checks.
- **Testing.** The `@cratis/arc.testing` package runs specs through the real command, query, and HTTP pipelines.
- **Client manifests.** `exportClientManifest` writes a JSON contract from the operations you registered with explicit `clientOutput` shapes, and `@cratis/arc.proxygenerator` turns it into proxies for the published `@cratis/arc` client. It does not discover definitions or read TypeScript types. See [Generate command and query clients](guides/generate-clients.md).

## A server for the clients you already have

Arc's TypeScript **client** packages already exist. They are built and released from the [Arc repository](https://github.com/Cratis/Arc), and this project does not replace, rename, or republish them.

| Package | Role | Where it comes from |
| --- | --- | --- |
| `@cratis/arc` | Client runtime for commands, queries, validation, identity, and observable queries | Arc repository, published to npm |
| `@cratis/arc.react`, `@cratis/arc.react.mvvm` | React bindings and MVVM support on top of the client | Arc repository, published to npm |
| `@cratis/arc.core` | Server core: pipelines, routing, results, and cross-cutting concerns | This repository, unpublished |
| `@cratis/arc.express`, `.fastify`, `.hono` | Host adapters that connect the core to a Node.js HTTP framework | This repository, unpublished |
| `@cratis/arc.proxygenerator` | Bounded generator and JSON-only CLI that write `@cratis/arc` proxies from an exported client manifest | This repository, unpublished |
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

## Releases

Arc for TypeScript is versioned independently of Arc on .NET. GitHub source previews are available; npm publication remains disabled. A major release is never made automatically: it requires verified full parity with Arc on .NET and an explicit merge by a maintainer. See [Preview a TypeScript release](contributing/releases.md).

## Where to go next

- [Get started](getting-started.md): run the Tasks sample and read it line by line.
- [Guides](guides/index.md): host, call, validate, query, configure, compose services, test, and persist.
- [Generate command and query clients](guides/generate-clients.md): export a client manifest and write typed proxies for the published `@cratis/arc` client.
- [Architecture](explanation/architecture.md): the standalone CQRS boundary, the core and host adapters, and how Arc concepts map to TypeScript.
- [Capability reference](reference/capabilities.md): each Arc feature family, its status here, and the deliberate differences.
- [Arc HTTP contract](/arc/http-contract/): the wire protocol every Arc backend speaks.
