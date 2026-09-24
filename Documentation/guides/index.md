---
title: Guides
description: Task-focused guides for hosting, calling, validating, authorizing, querying, and persisting with Arc for TypeScript.
---

These guides assume you have run the [Tasks sample](../getting-started.md) and know how a command and a query are defined. Each one solves a single problem.

:::note[Unpublished source]
The guides describe the current source in this repository. No package is published to npm, and Arc for TypeScript does not have full parity with Arc on .NET. The [capability reference](../reference/capabilities.md) lists what is supported and what is not implemented.
:::

| Guide | Use it when you want to |
| --- | --- |
| [Define commands](commands.md) | Add a model-bound command with typed fields, a handler, and an optional preparation step. |
| [Define read models and queries](read-models-and-queries.md) | Bind named query arguments and scope services; expose an observable query. |
| [Use concepts](concepts.md) | Decode domain values and nested fields without losing the wire schema. |
| [Register services](dependency-injection.md) | Choose a lifetime, declare constructor and method dependencies, and preflight the graph. |
| [Build an application](application-setup.md) | Discover artifacts, configure routes, and start a standalone or adapted host. |
| [Use low-level definitions](low-level-definitions.md) | Keep a Zod-backed command or query instead of converting it to decorators. |
| [Host Arc in Express, Fastify, or Hono](host-integration.md) | Serve your commands and queries from the web framework you already use. |
| [Host Arc directly in Node.js](standalone-host.md) | Serve Arc and a built SPA without a web framework. |
| [Call Arc from code](direct-calls.md) | Run a command or query from a spec, a job, or a Fetch API host, without a web framework. |
| [Validate model-bound commands and queries](validation.md) | Add command, query, concept, and model rules before the handler runs. |
| [Validate and authorize commands and queries](validation-and-authorization.md) | Add authentication, roles, per-request authorization, and low-level business rules, and know which check runs first. |
| [Decide command outcomes](command-outcomes.md) | Load data before a command runs, reject or deny from inside it, and wrap it in execution scopes. |
| [Bind query arguments, page, and sort](queries.md) | Send arguments with GET or `QUERY`, page and sort results, or return a page your database already cut. |
| [Stream an observable query](observable-queries.md) | Read a current snapshot and subscribe over direct or multiplexed SSE/WebSocket transports. |
| [Configure the server](configuration.md) | Change route prefixes and paths, resolve tenants, limit request bodies, and control what errors reveal. |
| [Compose services and test pipelines](services-and-testing.md) | Register scoped services and exercise real command and query pipelines in specs. |
| [Generate typed clients](generate-clients.md) | Export explicit contracts and generate clients for the existing Arc frontend runtime. |
| [Read models from MongoDB](mongodb.md) | Serve queries from a tenant's MongoDB database with a filter your code controls. |
| [Append Chronicle events from commands (experimental)](chronicle.md) | Review the experimental Chronicle integration and why it cannot run against Chronicle yet. |
