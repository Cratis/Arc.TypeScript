<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE in the project root. -->
# @cratis/platform

Cratis for Node.js in one install, like the `Cratis` package for .NET. It brings in Arc (`@cratis/arc.core`, `@cratis/arc.express`), the Chronicle integration (`@cratis/arc.chronicle`), the Chronicle client (`@cratis/chronicle`) and the testing helpers (`@cratis/arc.testing`). `CratisApplication.createBuilder()` and `builder.addCratis()` register Chronicle without choosing an authentication handler. The `./testing` export re-exports Arc and Chronicle testing helpers.

```sh
npm install @cratis/platform
```

Add `@cratis/arc.fastify`, `@cratis/arc.hono`, `@cratis/arc.mongodb` or `@cratis/arc.drizzle` only if you use them. Arc's Chronicle integration is bounded; see the [package reference](https://github.com/Cratis/Arc.TypeScript/blob/main/Documentation/reference/packages.md) and [Chronicle integration guide](https://github.com/Cratis/Arc.TypeScript/blob/main/Documentation/chronicle/add-event-sourcing.md).
