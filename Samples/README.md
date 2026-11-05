<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE file in the project root for full license information. -->
# Samples

Runnable samples of Arc for TypeScript. Each sample has a `run.sh`: `./run.sh` starts it, `./run.sh test` tests it. `./run-tests.sh` here tests all of them. `node check-slices.mjs` proves they keep the vertical-slice layout.

Requirements: Node.js 22.19+ and Yarn 4 (`corepack enable` once if `yarn` is missing). The scripts install and build what they need. Docker is needed to run `Library` (Chronicle) and the MongoDB page of `Showcase`; the specifications of all three run without it.

| Sample | What it shows | Start | Port |
| --- | --- | --- | --- |
| [`Tasks`](Tasks) | The smallest Arc app: a model-bound command with validators, snapshot and observable queries, paging and sorting, no Chronicle, no database | `./run.sh` | 3000 |
| [`Library`](Library) | An event-sourced app on Chronicle: commands appending events, constraint, projections, role authorization, live lists, a React app on Cratis Components (experimental Chronicle integration) | `./run.sh` or `./run.sh dev` | 3000 / 5173 |
| [`Showcase`](Showcase) | The .NET and Elixir showcases ported: ticker, live feed, query showcase, authentication, cross-cutting authorization, observable collections, change stream, MongoDB with tenancy; WebSocket and SSE hubs, delta mode | `./run.sh` or `./run.sh dev` | 3002 / 5174 |

## Every sample is a set of vertical slices

Each feature is a folder under `Features/`, and each slice in it holds everything for one behavior: the backend artifact, its generated proxy, its UI and its `for_*/when_*` specifications. See [Vertical slices](../Documentation/vertical-slices.md).

```text
Features/LiveFeed/Posting/
├── Posting.ts                      the command and its validator
├── PostToFeed.proxy.ts             generated TypeScript proxy
├── PostForm.tsx                    the UI
└── for_PostToFeed/
    ├── given/a_feed_post.ts
    └── when_posting/a_message.ts
```

There are no `controllers/`, `services/` or `components/` folders. A store, a concept or a model that several slices of one feature share sits at the feature level, never above it. `node check-slices.mjs` fails when a layer folder appears, a proxy or a specification leaves its slice, or a slice has no specifications.

## Chronicle for `Library`

`./run.sh` starts Chronicle with `docker compose -f Samples/Library/docker-compose.yml up -d`; set `CHRONICLE_URL` to use another owned development kernel.

## MongoDB for `Showcase`

`./run.sh` starts a one-node MongoDB replica set with `docker compose -f Samples/Showcase/docker-compose.yml up -d` (change streams need a replica set). Set `MONGODB_URL` to use your own, or `MONGODB_PORT` to move the container. To run the MongoDB specifications as well, point `ARC_MONGO_TEST_URI` at a replica set (for example `mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true`); without it they are skipped.

## Which .NET and Elixir samples map to what

| Arc (.NET) and Arc.Elixir | Arc for TypeScript |
| --- | --- |
| `ArcCore`, `Core`, Elixir `plug` | `Tasks` |
| `Chronicle`, Elixir `phoenix` and `frontend` | `Library` |
| `AspNetCore`, `Shared`, Elixir `showcase` | `Showcase` |
| `Layered`, `Layered.Contracts`, `Maui`, `SqlDependencyTest` | Not ported, see the `Showcase` README |
