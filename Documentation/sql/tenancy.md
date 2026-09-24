---
title: Route SQL by tenant
description: Route SQL access to a database per tenant with databaseFactory, and own the pools, credentials, and isolation checks.
---

Use `databaseFactory(tenant, context)` when tenant data must be isolated. Arc resolves it in each execution scope after its normal tenant resolution, lowercases the tenant ID, and rejects a missing tenant or an empty resolver result. The factory may return a connection or a pooled Drizzle database and may reuse one per tenant; **the application owns creation, cache limits, credentials and shutdown**. Arc never disposes a returned database. Avoid creating an unbounded pool for every untrusted tenant ID.

`database` is the short path for a single default-tenant database; requesting another tenant fails closed. For a shared database with tenant-specific schemas, return a pool/connection already confined to that tenant, such as one with a pinned schema search path. Never change a shared pooled connection's search path per request without a transaction and guaranteed reset. The adapter does not prepend a tenant predicate or validate your factory's tenant-to-database mapping. Verify cross-tenant reads and writes under your actual pool and authorization configuration.

.NET EF pooled contexts do not automatically infer per-tenant databases. This integration deliberately makes resolution explicit, similar to MongoDB's tenant-aware factory, rather than silently reusing one pool across tenants. See the [SQLite tenant-isolation spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Drizzle/for_DrizzleReadModels/when_paging_across_tenants/with_sqlite.ts).
