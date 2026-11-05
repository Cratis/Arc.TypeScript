<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE file in the project root for full license information. -->
# Showcase: the Arc samples as vertical slices

The showcase pages of [Arc.Elixir](https://github.com/Cratis/Arc.Elixir/tree/main/Samples/showcase) and the shared [Arc (.NET) samples](https://github.com/Cratis/Arc/tree/main/Samples), ported to Arc for TypeScript: an Express server, generated TypeScript proxies and a small React shell. It is a development demonstration, not an authentication template: the "users" are synthetic and chosen with a cookie.

## Run it

From the repository root (Node.js 22.19+, Yarn 4, and Docker for the MongoDB page):

```sh
Samples/Showcase/run.sh          # starts MongoDB, builds, serves everything on http://127.0.0.1:3002
Samples/Showcase/run.sh dev      # server and generator watching, plus Vite on http://127.0.0.1:5174
Samples/Showcase/run.sh test     # slice layout, proxies, types, lint, specifications and the web build
```

Stop MongoDB again with `docker compose -f Samples/Showcase/docker-compose.yml down`. `PORT` moves the server, `MONGODB_URL` selects another MongoDB, `MONGODB_PORT` moves the compose container. Without MongoDB every page works except the MongoDB one. The MongoDB specifications run when `ARC_MONGO_TEST_URI` points at a replica set and are skipped otherwise.

The toolbar switches the transport (WebSocket or SSE), the number of connections, direct mode, the transfer mode (full or delta), the tenant (`default`, `acme`, `globex`) and the signed-in user (anonymous, Ada the admin, Grace the reader). Changing one reloads the page so every subscription uses it. Delta transfer is for the change stream page, whose `useChangeStream` reads change sets; the other pages need full snapshots, so leave **Full** selected there.

## Features

| Feature | Slices | What it shows |
| --- | --- | --- |
| `Ticker` | `Observing` | An observable query over an RxJS interval |
| `LiveFeed` | `Posting`, `Viewing` | A validated command and two live queries, one with an argument |
| `QueryShowcase` | `Listing`, `Lookup` | Server-side sorting and paging of arrays, queries with arguments |
| `Authentication` | `Queries`, `Identity`, `SignIn` | `@allowAnonymous()` and `@authorize()` queries, an identity details provider behind `/.cratis/me`, cookie sign-in |
| `CrossCuttingAuthorization` | `Securing` | Global authorization filters guard a command and a query that declare no role |
| `ObservableCollection` | `Adding`, `Removing`, `Listing` | A live list with numeric ids |
| `ObservableCollectionWithGuid` | `Adding`, `Removing`, `Listing` | The same with `Guid` ids |
| `ChangeStream` | `Adding`, `Updating`, `Removing`, `Listing` | Added, replaced and removed items of every change (`useChangeStream`) |
| `MongoWatcher` | `AddingItems`, `ListingItems`, `AddingNotes`, `Summary` | `@cratis/arc.mongodb`: a database per tenant, a change-stream driven list, and a live join of two collections |

## Follow the code

Each slice holds its backend, generated proxy, UI and specifications. Shared stores and models sit at the feature level.

```text
Features/CrossCuttingAuthorization/
├── SecuredActions.ts                       shared by the slice
└── Securing/
    ├── Securing.ts                         RunSecuredCommand and the CrossCuttingStatus read model
    ├── AdminGate.ts                        the global authorization filters
    ├── RunSecuredCommand.proxy.ts, Secured.proxy.ts   generated
    ├── SecuredPanel.tsx                    the UI
    └── for_RunSecuredCommand/, for_CrossCuttingStatus/   specifications with CommandScenario and QueryScenario
Web/                                        the shell: toolbar, navigation, Vite config
main.ts                                     host, tenancy, identity and MongoDB wiring
```

After changing a slice, regenerate the proxies and metadata with `yarn workspace @cratis/arc.sample.showcase generate-proxies`; `dev` does it for you. The specifications use `@cratis/arc.testing`: `CommandScenario`, `QueryScenario` and `ObservableQueryScenario`.

## Not ported

| Sample | Why |
| --- | --- |
| .NET `AspNetCore` controller-based commands and queries | MVC controllers are not applicable; the [capability reference](../../Documentation/reference/capabilities.md) lists them as ASP.NET Core only. Model-bound commands and queries are what the sample uses |
| .NET `Maui` | A .NET MAUI client; Arc for TypeScript has no equivalent host |
| .NET `Layered` and `Layered.Contracts` | They exercise the .NET proxy generator across assembly layers; the TypeScript generator works on one TypeScript project |
| .NET `SqlDependencyTest` | SQL Server `SqlDependency` notifications. TypeScript observes SQL tables through Drizzle ([`DrizzleObservation`](../../Documentation/sql/observing-tables.md)), which needs its own database sample |
| .NET `Chronicle` showcase pages | Covered by the [`Library`](../Library) sample |
| Elixir conditional queries page | Not a separate page: `Lookup` shows queries with arguments, and the generated proxies expose `when(condition)` for conditional subscriptions |
| MongoDB-side paging (`collection.queryPage`) | The proxy generator cannot yet bind a `QueryOptions` parameter (`unbound query parameter options`), so `ListingItems` lists documents and lets Arc sort and page the array in memory |

## Not verified here

The React shell is type-checked, built and was loaded in a browser, which opened its SSE hub connection, but it has no automated browser specifications. The delta transfer mode is untested in the shell.
