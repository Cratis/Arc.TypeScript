---
title: Introspection
description: Ask a running Arc application which commands and queries it serves, with routes and input JSON Schema, from the access-controlled /.cratis introspection endpoints, and know what they expose.
---

You open a service you did not write, or one you wrote six months ago, and need to know what it accepts. Reading every feature folder takes a while. A developer tool, a contract test, or an AI assistant helping you has the same problem, and often cannot read the source at all.

So ask the running application. Arc describes itself at three endpoints, built from the same metadata that binds requests, so the answer is never out of date.

| Endpoint | Returns |
| --- | --- |
| [`GET /.cratis/commands`](commands.md) | Every command, with its route and payload schema |
| [`GET /.cratis/queries`](queries.md) | Every query, with its route, full name, and arguments schema |
| [`GET /.cratis/identity-details/schema`](identity-details-schema.md) | The JSON Schema of the identity details `/.cratis/me` returns |

## Try it

Start the Tasks sample and ask for its commands:

```bash
curl http://127.0.0.1:3000/.cratis/commands
```

You get one entry for `RegisterTask`, with the route `/api/tasks/registration/register-task` and a JSON Schema that requires a UUID `id` and a string `title`. [Command introspection](commands.md) shows the full answer. The queries endpoint lists `allTasks`, `taskById`, and `observeAllTasks` the same way.

Behind that answer there is no extra registry. Arc builds the list from the operations it compiled at startup, and the schemas from the `@field` declarations or Zod schemas that also validate incoming requests. Rename a field, restart, and the endpoint shows the new name.

## What it exposes, and to whom

An allowed caller sees every operation, whether or not they may invoke it. Catalogs describe names, routes, and input shapes, never application data. They accept only GET; other methods on a mapped route answer 405 with `Allow: GET`.

## Production access

Discovery is anonymous only in Development by default. Elsewhere, Arc runs the configured `authentication` handlers (or uses the host-verified `nativePrincipal`) and requires an authenticated principal. Anonymous callers receive 401; a caller missing the configured role receives 403. Denials have a JSON `{ error }` body. Discovery responses carry `Cache-Control: no-store`.

The same policy covers `/.cratis/commands`, `/.cratis/queries`, `/.cratis/identity-details/schema`, `/.cratis/users`, `/.cratis/tenants`, and `/openapi.json` on Express, Fastify, Hono, and the fetch handler. Command/query invocation, the observable transports, and `/.cratis/me` keep their own access rules.

| Option | Default and meaning |
| --- | --- |
| `introspection.enabled` | `true`: map catalogs and HTTP OpenAPI, subject to the access policy. `false`: leave them unmapped in every environment. Identity discovery is unchanged. |
| `introspection.requireAuthentication` | Unset: environment default. `true`: require authentication even in Development. `false`: explicitly allow anonymous discovery everywhere. |
| `introspection.roles` | Optional comma-separated roles; any one grants access. Roles are trimmed and case-sensitive. Setting roles implies authentication in every environment. Empty roles or combining roles with `requireAuthentication: false` fails startup. |
| `environmentName` | Code-only discovery environment override, otherwise `DOTNET_ENVIRONMENT`, then `ASPNETCORE_ENVIRONMENT`, then `NODE_ENV`. Only `Development` (case-insensitive) selects anonymous discovery. Missing or unknown names are not Development. |

The Node builder uses the environment supplied through `configuration.env` when present, including its appsettings environment-file selection. The code-only `environmentName` option overrides those environment variables for discovery; `Cratis:Arc:EnvironmentName` and `Cratis__Arc__EnvironmentName` are not supported configuration keys. It does not change which environment file is loaded or the exception-detail default. Exception exposure still follows the host environment variables (or the Node builder's supplied `configuration.env`), unless `exposeExceptionDetails` is explicitly set. This keeps a discovery override from exposing exception details unexpectedly. Fetch runtimes without `process` must supply `environmentName: 'Development'` for local anonymous tooling. The `development` option only enables development providers; it does not select this environment or disable authentication.

Outside Development, a host without default Arc authentication handlers or `nativePrincipal: true` leaves all six routes unmapped and logs one startup warning. Named `authenticationSchemes` alone are not default handlers. Explicitly setting `requireAuthentication: true` or roles without a way to authenticate instead fails startup. Arc sends startup warnings through `logger` with an empty correlation ID, or `console.warn` when no logger is supplied or it fails.

The Node configuration keys are `Cratis:Arc:Introspection:RequireAuthentication` and `Cratis:Arc:Introspection:Roles`, for example `Cratis__Arc__Introspection__RequireAuthentication=false`. Code options override corresponding configuration fields. An anonymous opt-out outside Development logs a startup warning too.

For build-time tools fetching descriptions, run the local host in Development or supply valid credentials. Source-based proxy generation and the in-process `server.openApi()` API do not make HTTP requests and are unaffected. See [Migrating to secure discovery defaults](../upgrading/secure-defaults.md) before upgrading a deployed anonymous consumer.

## Turn discovery off

If deployed tools do not need command/query catalogs or HTTP OpenAPI, set `Cratis:Arc:Introspection:Enabled` to `false`. Arc leaves `/.cratis/commands`, `/.cratis/queries`, and `/openapi.json` unmapped on Express, Fastify, Hono, and fetch. Requests fall through to the host, normally returning 404, even for authenticated callers.

To disable those endpoints everywhere, put this in `appsettings.json`:

```json
{
  "Cratis": {
    "Arc": {
      "Introspection": { "Enabled": false }
    }
  }
}
```

To keep local discovery but turn it off only in deployed environments, put the same block in `appsettings.Production.json` instead and run the deployment with `DOTNET_ENVIRONMENT=Production`. Alternatively, set this environment variable **in the deployment**, not in your local environment:

```bash
Cratis__Arc__Introspection__Enabled=false
```

Or pass the same switch programmatically, overriding file and environment configuration:

```typescript
import { ArcApplication } from '@cratis/arc.core';

const builder = ArcApplication.createBuilder({
    introspection: { enabled: false }
});
const app = await builder.build();
```

The same `introspection: { enabled: false }` option works with the Node or fetch `ArcApplicationBuilder` constructor, the fetch `ArcApplication.createBuilder()`, `CratisApplication.createBuilder()`, and `new ArcServer(options)`. There is no separate fluent discovery setting or general `configure` callback. `runArc(server)` and `createArcNodeHandler(server)` use the options of the supplied server; Express, Fastify, and Hono helpers use the supplied server or built application. Their transport options do not accept another `introspection` override.

The default is `true`. Node configuration accepts boolean values (and case-insensitive `true`/`false` strings); invalid values fail setup. Code takes precedence per field: `introspection: { enabled: false }` overrides file and environment values. Fetch builders and `new ArcServer(...)` take that code option directly; they do not bind configuration files or `Cratis__...` variables.

This switch does not disable command/query execution, observable transports, `/.cratis/me`, or identity discovery. `/.cratis/identity-details/schema`, `/.cratis/users`, and `/.cratis/tenants` retain the access policy above; user/tenant data still requires opt-in development providers. In-process `server.openApi()`, `exportClientManifest(server)`, and source-based proxy generation keep working.

Like Arc for .NET's ASP.NET Core and Arc.Core hosts, disabled catalogs can be combined with `requireAuthentication: true` or roles **when authentication is configured**. Without authentication, explicit requirements still fail startup for identity discovery; the default non-Development missing-authentication warning also remains. Disabling catalogs does not excuse invalid roles or roles combined with `requireAuthentication: false`. The anonymous opt-out warning remains too. .NET skips the catalog mapper's authentication check when disabled, but its identity mapper still resolves the policy.

TypeScript also disables `/openapi.json` deliberately: it belongs to the same HTTP discovery group as the catalogs. This extends .NET's catalog switch; .NET does not serve that route through its catalog mapper. It does not affect the in-process OpenAPI API.

## How it relates to OpenAPI and proxies

Introspection, [`/openapi.json`](../open-api/index.md), and the [proxy generator](../proxy-generation/index.md) all see the same schemas. They serve different readers:

| Use | For |
| --- | --- |
| Introspection | Arc-aware tools that need Arc's own names: the fully qualified query name for hub subscriptions, or the `/validate` route of a command |
| OpenAPI | General HTTP tooling: API clients, gateways, and code generators for other languages |
| Proxy generator | Your TypeScript frontend, generated from source at build time without a running server |

[How types appear in the document](../open-api/schemas.md) explains how concepts, enums, and optional fields are rendered, and applies to the introspection schemas too. [Concepts in the document](../open-api/concepts.md) and [Enums in the document](../open-api/enums.md) go into detail.

## Related

- [Endpoint mapping](../core/endpoint-mapping.md)
- [HTTP contract reference](../reference/http-contract.md)
