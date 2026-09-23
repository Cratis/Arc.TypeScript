# Arc for TypeScript

**A server-side implementation of the [Arc](https://github.com/Cratis/Arc) CQRS framework for TypeScript and Node.js.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/1182595891576717413?label=Discord&logo=discord&logoColor=white)](https://discord.gg/kt4AMpV8WV)

> [!IMPORTANT]
> **Status: bootstrap.** This repository contains no source code, no packages, and no releases yet. Nothing described below is implemented. Package names and public APIs will be chosen once the architecture work is complete; until then, treat everything on this page as intent, not a contract.

Arc is an opinionated CQRS application framework: commands, queries, validation, authorization, identity, tenancy, and observable queries, discovered by convention instead of hand-wired. Arc on .NET hosts that behavior on ASP.NET Core, and [Arc for Kotlin and Java](https://github.com/Cratis/Arc.Kotlin) hosts it on Spring Boot. This repository brings the same model to Node.js, written as idiomatic TypeScript rather than a line-by-line port.

## What this repository is for

| Goal | Intent |
| --- | --- |
| Parity with Arc on .NET | Match the behavior of Arc on .NET, which remains the reference implementation. Parity is claimed area by area, only once it is verified. |
| One wire protocol | Speak the [Arc HTTP contract](https://github.com/Cratis/Arc/blob/main/Documentation/http-contract.md), so existing Arc clients work against a TypeScript backend unchanged. |
| Idiomatic TypeScript | Follow TypeScript and Node.js conventions where the platforms differ, instead of mirroring .NET mechanics. |
| No required storage | The core has no dependency on event sourcing or a database. [Chronicle](https://github.com/Cratis/Chronicle) and MongoDB are intended as optional integrations. |
| Host frameworks | Express, Fastify, and Hono are the Node.js HTTP frameworks we intend to support. **None of them is supported yet.** |

## Relationship to `@cratis/arc`

[`@cratis/arc`](https://github.com/Cratis/Arc/tree/main/Source/JavaScript/Arc) is Arc's existing TypeScript **client** runtime: the command, query, validation, identity, and messaging code that generated proxies and `@cratis/arc.react` use to call an Arc backend. It is built and released from the [Arc](https://github.com/Cratis/Arc) repository.

This repository builds the **server** side. It does not replace, rename, or repurpose `@cratis/arc` or any other published Arc package. The existing client is the compatibility target for this server's wire behavior.

## Arc does not require event sourcing

Arc is a CQRS framework first. Commands and queries can work through application services or current-state storage without an event log. Event-sourced behavior comes from the optional Chronicle integration, the same way it does in Arc on .NET. For event sourcing from TypeScript today, use the [Chronicle TypeScript client](https://github.com/Cratis/Chronicle.TypeScript).

## Contributing

Arc for TypeScript is a framework library, not an application. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. While the architecture is still open, start with an issue or a conversation on [Discord](https://discord.gg/kt4AMpV8WV) rather than a large change.

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
