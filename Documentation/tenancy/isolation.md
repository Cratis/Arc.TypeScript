---
title: Storage isolation
description: See how the MongoDB, Drizzle, and experimental Chronicle integrations turn the resolved tenant into a database, connection, or event store namespace, and how to verify the boundary.
---

Resolving `acme` for a request is only useful if the data really goes to Acme's storage. Each storage integration maps the resolved tenant to its own destination, and they do not all treat a missing tenant or letter case the same way. This page lists each mapping so you can line them up, then shows how to check that the boundary holds.

## How each integration maps the tenant

| Integration | Destination for tenant `acme` | Tenant `default` | No tenant |
| --- | --- | --- | --- |
| [MongoDB](../mongodb/tenancy.md), `database: 'tasks'` | Database `tasks+acme` | Database `tasks` | The request fails |
| [SQL with Drizzle](../sql/tenancy.md) | The connection `databaseFactory('acme', context)` returns | `databaseFactory('default', context)`, or the `database` option when there is no factory | The request fails |
| [Chronicle](../chronicle/index.md), experimental | Namespace `acme` in the configured event store | Namespace `default` | Namespace `Default` |

MongoDB and Drizzle lowercase the tenant ID before they use it. The Chronicle integration passes the ID to Chronicle as it is.

None of these checks membership. They trust the tenant Arc resolved, which is why [Tenancy](index.md) asks you to prove membership first.

## The Chronicle namespace rule

With `@cratis/arc.chronicle`, every append, and every read the integration makes through `ChronicleReadModels`, uses the event store namespace named by `context.tenantId`. When the execution has no tenant, it uses Chronicle's `Default` namespace. Arc does not rename tenants on the way: a built-in source that resolved `default` sends `default`, which is a different string from `Default`.

Commands that a reactor returns run in the namespace of the event that triggered them. Arc sets their `tenantId` to that namespace, so a reactor reacting to Acme's event can only produce commands for Acme.

To keep MongoDB, Drizzle, and Chronicle pointing at the same tenant, use the lowercase IDs that the built-in sources produce. If you write `tenancy.resolve`, return lowercase IDs too. The Library sample shows the single-tenant case: `tenancy: { resolve: () => 'Default' }` sends every request to Chronicle's `Default` namespace.

## Verify the boundary

Storage naming can look right while data still crosses tenants through a cache, a long-lived handle, or a background job. Test the boundary itself, with real storage where you can:

- **Four tenant states.** No tenant, the default tenant, and two named tenants. Assert both the answer and where the data landed.
- **A denied selection.** A caller naming a tenant they do not belong to gets 403, and nothing is read or written.
- **Concurrent requests.** Run requests for two tenants at the same time. `currentContext()` is per request, but a singleton that caches a collection, a connection, or query results is not.
- **Long-lived work.** Include observable queries, reactor-driven commands, and anything that runs after the request, since those carry the tenant they started with.
- **Direct calls.** A job that calls `app.server` directly passes its own context; check that it passes a tenant on purpose.

In specs, `CommandScenario.withContext({ tenantId })` sets the tenant for pipeline calls. It proves your code uses the tenant it is given. It does not prove your resolver or your storage configuration, so keep at least one check that goes through HTTP and real storage.

## Related

- [Tenancy](index.md)
- [Tenant resolvers](resolvers.md)
- [MongoDB tenancy](../mongodb/tenancy.md)
- [SQL tenancy](../sql/tenancy.md)
