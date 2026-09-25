---
title: Endpoint mapping
description: How Arc derives command and query routes from namespaces and names, how to change the convention, and how to pin a route with @path.
---

Arc derives every route. You never register a URL by hand, and a generated client always calls the same URL the server serves. This page explains the convention and the two ways to change it: configure it for the whole application, or override it for one artifact.

## The convention

A route is the prefix, the namespace segments, and the name, each converted to kebab case:

1. Start with `generatedApis.routePrefix`, `api` by default. An empty string removes the prefix. A prefix may contain letters, digits, `_`, `-`, and `/` between segments.
2. Split the namespace on dots and drop the first `generatedApis.segmentsToSkipForRoute` segments.
3. Convert each remaining segment and the name to kebab case. Acronyms stay together: `CreateTask` becomes `create-task`, `HTTPReader` becomes `http-reader`, and `_` becomes `-`.

For a model-bound artifact, the namespace comes from its folder below the [discovery root](getting-started.md#discover-artifacts-from-a-folder), or from `@command({ namespace })` and `@readModel({ namespace })`. The name is the command class name, or the query method name:

| Artifact | Namespace | Route |
| --- | --- | --- |
| `RegisterTask` in `Features/Tasks/Registration/` | `Tasks.Registration` | `POST /api/tasks/registration/register-task` |
| `TaskItem.allTasks` in `Features/Tasks/Listing/` | `Tasks.Listing` | `GET /api/tasks/listing/all-tasks` |

A query's identity still includes the read-model class, `Tasks.Listing.TaskItem.allTasks`, even though the route does not. Direct calls and generated clients use that identity.

Every command also gets a validation route: its route followed by `/validate`. A command whose own route ends in `/validate`, such as one named `Validate`, still executes on that route.

## Change the convention

Pass `generatedApis` to `ArcApplication.createBuilder(...)` or `new ArcServer(...)`:

```typescript
const builder = ArcApplication.createBuilder({
    generatedApis: {
        routePrefix: 'api',
        segmentsToSkipForRoute: 1,
        includeCommandNameInRoute: true,
        includeQueryNameInRoute: true
    }
});
```

| Option | Default | Effect |
| --- | --- | --- |
| `routePrefix` | `'api'` | First route segment; `''` for none |
| `segmentsToSkipForRoute` | `0` | Leading namespace segments to drop, such as a company name |
| `includeCommandNameInRoute` | `true` | Omit the command name when `false`, unless that would make two routes in one namespace collide |
| `includeQueryNameInRoute` | `true` | The same for queries |

Keep the [proxy generator](../proxy-generation/configuration.md) route options in step with these, or generated clients call the wrong URL.

## Pin one route with @path

Moving a file changes its derived route. When a public URL must not move, override it:

```typescript
@command()
@path('/api/tasks/register')
export class RegisterTask { /* fields and handle() */ }
```

`@path` works on a command or read-model class, and on a `@query()` method, where it overrides the class path. The path must start with a single `/`, contain only letters, digits, `/`, `_`, and `-`, and must not contain `..`. A trailing slash is removed, and the prefix is not added. Low-level definitions take `path` as a property instead.

`@path` on a static method without `@query()` fails at build: it would have no effect.

## What startup rejects

The server refuses to start rather than serve a weakened contract when a name or namespace segment does not start with a letter or contains anything but letters, digits, and `_` (even with an explicit path), when a path or prefix is unsafe, when two operations share a namespace and name (compared case-insensitively), or when two routes collide, including a command's `/validate` route and the reserved `/.cratis` and `/openapi.json` paths. The full list is in [Configuration](../configuration/index.md#what-startup-rejects).

## Reserved paths

| Path | Purpose |
| --- | --- |
| `/.cratis/commands`, `/.cratis/queries` | [Introspection](../introspection/index.md) |
| `/.cratis/identity-details/schema`, `/.cratis/me` | [Identity](../identity/index.md) |
| `/.cratis/users`, `/.cratis/tenants` | [Development users and tenants](../identity/development-users-and-tenants.md) |
| `/.cratis/queries/ws`, `/.cratis/queries/sse` | [Multiplexed observable queries](../queries/observable-query-demultiplexer.md) |
| `/.cratis/queries/health` | [Query health](../queries/query-health.md), when enabled |
| `/openapi.json` | [OpenAPI](../open-api/index.md) |

The complete route table, with methods and answers, is in the [HTTP contract reference](../reference/http-contract.md).
