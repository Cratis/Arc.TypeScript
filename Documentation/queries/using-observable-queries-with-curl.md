---
title: Using observable queries with curl
description: Read an observable query's snapshot, wait for its first result, and stream updates over server-sent events from a terminal.
---

You can explore a live query without writing frontend code. These commands run against the Tasks sample on `127.0.0.1:3000`; replace the route with your own query's route from `/.cratis/queries`.

## Read the current snapshot

```bash
curl -i http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks
```

| Status | Meaning |
| --- | --- |
| 200 | The source has a current value; `data` holds it and `isReady` is `true` |
| 202 | No value yet; `isReady` is `false`. This is not a failure |
| 403 | Not authorized, or an [emission guard](observable-query-emission-guards.md) denied the snapshot |
| 503 | A subscription limit is reached; retry after `Retry-After` |

## Wait for the first result

```bash
curl 'http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks?waitForFirstResult=true&waitForFirstResultTimeout=5'
```

For a pending source, `waitForFirstResult=true` waits for its first emission. The default wait is 30 seconds; `waitForFirstResultTimeout` accepts a positive number of seconds up to 120. A timeout answers 408; a source that completes before its first value answers 500. Invalid wait options answer 400. Booleans are case-insensitive (`True` works), and an unrecognized boolean is rejected, where Arc on .NET ignores it. Arc on .NET also accepts larger timeouts; this server bounds them to avoid retaining unlimited subscriptions.

## Stream updates

```bash
curl -N -H 'Accept: text/event-stream' http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks
```

`-N` turns off buffering. You receive one `data: <query result JSON>` frame now and one for every change; register a task in another terminal to see the next one. Press Ctrl+C to end the subscription; the server releases the source.

## Structured arguments

A GET passes arguments in the query string. To send structured arguments to an observable query, use the [HTTP `QUERY` method](using-the-http-query-method.md), which answers with a snapshot.

## Related

- [Observable queries](observable-queries.md)
- [Introspection](../introspection/queries.md) to list query routes
