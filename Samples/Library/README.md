<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE file in the project root for full license information. -->
# Library: a full-stack Arc sample

Register an author, add books to their shelf, and watch the author list update without reloading. This is the Library domain from the [shared Arc tutorial](https://www.cratis.io/arc/tutorial/first-slice/), implemented with Arc for TypeScript on Express and the published Arc React client. The sample is a **development demonstration**, not an authentication template.

## Run it

From the repository root (Node 22.19+ and Yarn 4):

```sh
yarn install
yarn workspace @cratis/arc.sample.library dev
```

Open <http://127.0.0.1:5173>. The dev command builds the framework packages needed by the sample, generates the metadata and browser proxies from `Features/`, then watches the backend with `tsx`, the proxy generator with `--watch`, and the Vite frontend. The backend listens on `127.0.0.1:3000`; Vite proxies `/api` and `/.cratis` to it. Ctrl+C ends all three workers.

Without `MONGODB_URL` or `CHRONICLE_URL`, authors and books live in application memory and disappear on restart. Set **one** of these environment variables before starting:

- `MONGODB_URL`: persist through Arc MongoDB collections. Live queries require a replica set with change streams, not a standalone MongoDB server.
- `CHRONICLE_URL`: use an experimental Chronicle development kernel. The `Authors` and `Books` services append constructor-created `AuthorRegistered` and `BookAdded` events in this dual-mode example; Chronicle projects the author and book read models, and `AuthorWelcomeReactor` appends a follow-up event. A Chronicle-only application should instead return events directly from command `handle()` so Arc owns the append boundary. The SDK's materialization and reactor observation are asynchronous; an acknowledged append does **not** mean the queries or reactor have caught up. The sample's query services load the small projected catalog and subscribe to changes; an observable GET can answer 202 until its first result. Use a `chronicle://localhost:35000` development connection string only against your own local kernel. The host selects the fixed `Default` tenant for this demonstration.

The modes are mutually exclusive. This sample's author page loads the list before Arc pages it; it is intended for a small catalog, not an unbounded production collection.

The backend assigns a fixed `Librarian` principal inside the loopback-only Express host to demonstrate `@roles('Librarian')` on `RegisterAuthor`. It does not authenticate visitors. Do not expose this host publicly or copy that principal into production; connect a real host-verified identity before deployment.

## Follow the code

- `Features/Authors/Registration/Registration.ts` holds the command, its validator, the registration event, and a follow-up reactor. The command's `@key()` identifies the author; `AuthorNameValidator` enforces the name's own rules.
- `Features/Authors/Listing/Listing.ts` serves both the live list and the paged snapshot. `Features/Books/Registration/Registration.ts` and `Features/Books/Listing/Listing.ts` add and read books by author id. All exports are discovered per slice file; each generated client proxy still has its own output file.
- `Features/generatedMetadata.ts` and `Web/src/generated/` are produced by `arc-proxygenerator`. Change the decorated source, then regenerate; never edit generated files.
- `Web/src/Features/` uses the generated `.use()` hooks. The author list is observable, the page controls request five authors at a time, and the filtered book query updates that author's shelf live.

## Check it

```sh
yarn workspace @cratis/arc.sample.library build
yarn workspace @cratis/arc.sample.library test:e2e
yarn ci
bash Samples/Library/run-integration.sh
```

The smoke test starts the compiled Express server in memory mode and runs generated command and query proxies against the real HTTP listener. The integration script starts **task-owned** MongoDB and Chronicle containers in turn, tests each mode over HTTP with real storage, and stops its own containers. It needs Docker and the `mongo:7.0` and `cratis/chronicle:latest-development` images; it does not test the browser UI. The slice specifications run through `CommandScenario` and `QueryScenario` in `yarn ci`.
