---
title: SQL with Drizzle
---

`@cratis/arc.drizzle` connects Arc queries to application-owned Drizzle databases. It supports SQLite and PostgreSQL with executable database checks; MySQL uses the same SQL query path but has **not** been exercised against a live MySQL server. This is a source preview, not a published npm package.

Use [Get started](getting-started.md) to wire one SQLite database into an Arc read model. Then choose [column conversions](column-types.md), [tenant routing](tenancy.md), [read-only access](read-only.md), [paging and sorting](paging.md), or [migrations](migrations.md). [Observation](observing.md) describes the unsupported live-query boundary.

Drizzle ORM 0.45.x is a fit for this Node integration: its typed, SQL-first schema and query builders support PostgreSQL, MySQL, and SQLite without importing EF Core's change tracking or requiring Chronicle. This is a choice of integration, not an assertion that the ORMs have identical semantics.
