---
title: Keep SQL queries read-only
---

Inject `service(drizzleReadModel(Model))` into a read-model query. The scoped `DrizzleReadModels<Model>` handle exposes `queryPage(filter, options)`, `find(filter, sorting?)`, `findOne(filter)` and its table; `find` rejects more than `maxPageSize` matches instead of silently truncating results, and `findOne` returns the first primary-key-ordered match or `undefined`. None of these APIs accept a query cancellation signal or propagate Arc's `context.signal` to the driver; timeouts and cancellation must be managed by the application or database driver. The handle does not expose a writable Drizzle database. Use a typed Drizzle `SQL` predicate built with bound parameters, not string-interpolated request input. If a command needs to write, inject `service(drizzleDatabase<YourDatabaseType>())` and use the returned `.native` database.

This is an API boundary, **not** a database permission boundary. It cannot stop a caller from injecting the writable token elsewhere, and JavaScript can bypass TypeScript visibility. Provision read-only database credentials for queries if writes must be prohibited. Unlike .NET's `ReadOnlyDbContext`, there is no EF tracking or SaveChanges interceptor to turn off; Arc has no unit of work or automatic SQL transaction here.

The registered pool is application-owned. Disposing a query scope releases its Arc handle, not its underlying connection or pool. Close that pool explicitly at application shutdown after `await app.dispose()`.
