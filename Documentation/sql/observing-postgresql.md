---
title: Observe PostgreSQL tables across processes
description: Install application-owned change triggers and opt into PostgreSQL LISTEN/NOTIFY for Drizzle read models.
---

**Experimental.** This protocol and its versioned trigger names may change before it leaves experimental status. Use [in-process observation](observing-tables.md) for SQLite, MySQL, or PostgreSQL when only local, explicitly announced changes are needed. PostgreSQL mode observes committed changes from other connections and processes; there is no fallback to in-process observation if the listener fails.

## Install triggers in an application migration

Arc does not create or repair database objects at runtime. For every registered observed PostgreSQL table, generate a drizzle-kit **custom migration**, paste the SQL returned by `postgresqlChangeTrigger(table, { schema: 'app' })` into that migration, and deploy it with your application's migrations before opening observations. For tables declared with `pgSchema('app').table(...)`, omit `schema`; a conflicting override is rejected. Schema-less tables require an explicit migration schema (even if it is `public`). Pass the base `PgTable`, not a Drizzle `alias(...)`; aliases are rejected even if an existing table has the alias name. Run the helper once per table. An existing trigger with the reserved name fails migration installation instead of being overwritten; replace an owned trigger deliberately during an upgrade. Ordinary reads and writes still work without the triggers, but starting an observation fails before its first model read.

```typescript
import { postgresqlChangeTrigger } from '@cratis/arc.drizzle';
import { tasks } from './schema.js';

const migrationSql = postgresqlChangeTrigger(tasks, { schema: 'app' });
// Write migrationSql into an application-owned drizzle-kit custom migration.
```

The helper creates `arc_notify_changes_v1()` and `arc_changes_v1` in the table's schema: an invoker-security, statement-level AFTER INSERT/UPDATE/DELETE/TRUNCATE trigger. It publishes only the canonical, SQL-quoted `schema.table` name to the fixed `arc_changes` channel, not row contents, keys, or tenant identifiers. The channel is database-wide and is **not** an authorization boundary. Duplicate notifications or extra snapshots are possible; NOTIFY delivers no durable history. The reader must see current committed data. Queries with long-lived transaction snapshots or lagging replicas are unsupported.

## Connect one dedicated listener per active tenant

Install `pg` ^8 as an application dependency when using `nodePostgresListener`; `@cratis/arc.drizzle` does not load `pg` at runtime for other modes. The listener factory must return a **new, unconnected, dedicated** `pg.Client` (not a `Pool` client or the connection Drizzle uses). Arc connects and closes it. Use a direct PostgreSQL connection or session-pooled proxy, not PgBouncer transaction/statement pooling. The factory receives a cancellation signal for this tenant listener, not a request's lifetime.

```typescript
import { Client } from 'pg';
import { DrizzleDialect, DrizzleObservation, nodePostgresListener } from '@cratis/arc.drizzle';

builder.withDrizzle({
    dialect: DrizzleDialect.PostgreSQL,
    databaseFactory: (tenant) => queryDatabaseFor(tenant),
    readModels: [{ type: TaskRecord, table: tasks }],
    observation: {
        mode: DrizzleObservation.PostgreSQLNotify,
        listener: async (tenant, { signal }) => {
            const configuration = await listenerConfigurationFor(tenant, signal);
            return nodePostgresListener(new Client(configuration));
        }
    }
});
```

The factory and Drizzle query database must route each tenant to the **same primary database**. A schema-less Drizzle table resolves through the **reader's** `search_path`, not the listener's. Keep every connection in a reader pool on the same stable role and `search_path`; request-dependent `SET LOCAL` is unsupported. Separate schemas in one database route by canonical schema/table payload; tenants reading the same physical table receive the same invalidations. Table filters and RLS remain your responsibility. Temporary tables, views, partitioned tables, partitions, tables with inheritance parents or children, and aliased `PgTable` read-model registrations are unsupported. A statement trigger fires only on the table a write names: a write through a parent never reaches a child's trigger, and a write to a child never reaches the trigger of a parent whose reads include the child's rows. Register the physical base table instead; alias names are not physical trigger targets. Normal writes with `session_replication_role = replica` may skip the trigger and are unsupported.

`observe()`, `observeById()`, and `observePage()` open a lease before reading rows. The first lease for a tenant opens LISTEN; every lease then resolves the table it reads, checks that the listener is connected to the same database, and checks the trigger in `pg_trigger` and its helper in `pg_proc`. Missing, disabled, or incompatible triggers fail that observation; Arc does not attempt DDL or silently degrade. A plain HTTP GET of an observable query calls `current()` and likewise incurs a dedicated per-tenant listener and catalog reads until its scope closes. One tenant with several active subscriptions shares a connection; closing the final lease ends it. Budget one listener backend per active tenant and monitor `pg_stat_activity`. `notifyChanged()` still validates its registered target but publishes **nothing locally** in PostgreSQL mode: the database trigger is the sole invalidation source.

On a listener `error`/`end` or heartbeat failure, all tenant subscriptions fail and the connection is closed. There is **no transparent reconnect in this increment**. A fresh subscription opens a new listener and reads a fresh snapshot; updates during the gap are reflected in that snapshot, but intermediate states are not replayed. The installed `@cratis/arc` frontend's direct SSE `EventSource` retries a closed stream automatically; its SSE hub also reconnects and re-subscribes active queries. Custom SSE/HTTP consumers must reconnect and subscribe again themselves. A terminal query error delivered as a result frame may require application-level retry rather than relying only on EventSource's transport retry. For detection of half-open connections Arc sends `SELECT 1` every 30 seconds; this does **not** revalidate triggers after acquisition, so coordinate trigger migrations with observer restart. Watch `pg_notification_queue_usage()` as well: a stalled listener in a long-running transaction can fill the notification queue and make writers fail. Arc's listener only executes autocommit statements, never `BEGIN`.
