<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE file in the project root for full license information. -->
# Library: an event-sourced Arc sample

Register an author, add books to their shelf, and watch the author list update without reloading. This is the Library domain from the [shared Arc tutorial](https://www.cratis.io/arc/tutorial/first-slice/), implemented with Arc for TypeScript, Chronicle, Express, and the published Arc React client. The Chronicle integration is **experimental**. This is a development demonstration, not an authentication template.

## Run it

From the repository root (Node 22.19+, Yarn 4, and Docker):

```sh
yarn install
docker compose -f Samples/Library/docker-compose.yml up -d
yarn workspace @cratis/arc.sample.library dev
```

Open <http://127.0.0.1:5173>. Register an author and add a book. The author list and book shelf update as Chronicle projections catch up. Stop the dev workers with Ctrl+C, then stop **only this sample's compose project** with `docker compose -f Samples/Library/docker-compose.yml down`. This removes its kernel and its bundled development MongoDB; data is not retained after the container is removed. The backend listens on `127.0.0.1:3000`; Vite proxies `/api` and `/.cratis` to it.

The development image bundles MongoDB for Chronicle's event store and read-model sink; no separate MongoDB server is needed. `appsettings.json` supplies `Cratis.Chronicle.connectionString` (`chronicle://localhost:35000`) and `eventStore` (`Library`). Set `CHRONICLE_URL` to override the connection string when running against another **owned development** kernel. There is no in-memory or direct MongoDB mode in this sample; [Tasks](../Tasks/main.ts) demonstrates Arc without Chronicle. Chronicle appends and projections are asynchronous: a successful command can precede an updated query. An observable GET can answer 202 before its first result. The paged snapshot loads the small catalog before Arc pages it; do not use it for an unbounded production list.

The backend assigns a fixed `Librarian` principal inside the loopback-only Express host to demonstrate `@roles('Librarian')`. It does not authenticate visitors. Do not expose this host publicly or copy that principal into production; connect a host-verified identity before deployment.

## Follow the code

- `Features/Authors/Registration/Registration.ts` holds `RegisterAuthor`, `AuthorRegistered`, and `UniqueAuthorName`. `handle()` returns the event, and `@key()` identifies its event source. Chronicle enforces name uniqueness across author streams at append time. `AuthorName.ts` keeps the concept and its validator together.
- `Features/Authors/Listing/Listing.ts` maps the event to a projected `Author`. Its Arc queries load the Chronicle read models and subscribe to changes for the observable list. The book registration and listing slices follow the same pattern under `Features/Books/`.
- `Features/generatedMetadata.ts` and `Web/src/generated/` are produced by `arc-proxygenerator`. Change the decorated source, then regenerate; never edit generated files.
- `Web/src/Features/` uses generated `.use()` hooks. The author list is observable, the page controls request five authors at a time, and the book query follows the selected author's shelf.

## Check it

```sh
yarn workspace @cratis/arc.sample.library build
bash Samples/Library/run-integration.sh
```

The integration script creates and removes **only its own** Chronicle development container, with bundled MongoDB. It exercises generated proxies over Express: author registration, uniqueness rejection, projected listings, book registration, and a live observable update. The `ChronicleCommandScenario` slice specs assert event appends without a kernel; only the live run checks the kernel's constraint and projection behavior. The browser UI is not exercised by the script.
