<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE in the project root. -->
# @cratis/arc.drizzle

Optional Drizzle SQL read-model integration for Arc for TypeScript.

Experimental cross-process PostgreSQL observation is opt-in with `DrizzleObservation.PostgreSQLNotify`, `nodePostgresListener(new Client(...))`, and application-owned SQL from `postgresqlChangeTrigger(table, { schema })`. Install `pg` ^8 in the application for this adapter; in-process/other dialect users do not need it. Listener loss ends subscriptions rather than silently falling back; `notifyChanged()` validates but does not publish locally in PostgreSQL mode. See [the PostgreSQL observation guide](https://github.com/Cratis/Arc.TypeScript/blob/main/Documentation/sql/observing-postgresql.md).

See the [SQL getting started guide](https://github.com/Cratis/Arc.TypeScript/blob/main/Documentation/sql/getting-started.md) and [package reference](https://github.com/Cratis/Arc.TypeScript/blob/main/Documentation/reference/packages.md).
