---
title: SQL observation limits
description: Why the Drizzle integration does not provide live observation, and what an application-owned change source must handle instead.
---

This integration does **not** expose `observe()` or automatically refresh Arc observable queries when SQL changes. SQLite has no cross-process notification mechanism in this adapter; Drizzle query execution alone does not announce writes. PostgreSQL `LISTEN/NOTIFY` would require managed triggers, a dedicated listener connection per isolation boundary, resubscription on reconnect, a race-free initial snapshot and tested shutdown. No such producer or trigger installation is included. MySQL is also unverified for observation.

If your application already has a reliable, tenant-scoped change source, Arc's core observable-query APIs can consume that application-owned source. Test initial-read races, external writes, failure and subscription disposal independently. An in-process event after a command write does not observe changes made by other processes. Do not treat this as parity with .NET EF's provider-dependent observation support.
