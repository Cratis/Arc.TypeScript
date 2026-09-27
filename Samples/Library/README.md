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

Open <http://127.0.0.1:5173>. Choose **Add author** on the Cratis Components `DataPage`, register an author in its `CommandDialog`, select the author, and add a book to their shelf. The observable author list and book shelf update as Chronicle projections catch up. Stop the dev workers with Ctrl+C, then stop **only this sample's compose project** with `docker compose -f Samples/Library/docker-compose.yml down`. This removes its kernel and its bundled development MongoDB; data is not retained after the container is removed. The backend listens on `127.0.0.1:3000`; Vite proxies `/api` and `/.cratis` to it.

The development image bundles MongoDB for Chronicle's event store and read-model sink; no separate MongoDB server is needed. `appsettings.json` supplies `Cratis.Chronicle.connectionString` (`chronicle://localhost:35000`) and `eventStore` (`Library`). Set `CHRONICLE_URL` to override the connection string when running against another **owned development** kernel. There is no in-memory or direct MongoDB mode in this sample; [Tasks](../Tasks/main.ts) demonstrates Arc without Chronicle. Chronicle appends and projections are asynchronous: a successful command can precede an updated query. An observable GET can answer 202 before its first result. The paged snapshot loads the small catalog before Arc pages it; do not use it for an unbounded production list.

The backend assigns a fixed `Librarian` principal inside the loopback-only Express host to demonstrate `@roles('Librarian')`. It does not authenticate visitors. Do not expose this host publicly or copy that principal into production; connect a host-verified identity before deployment.

## Follow the code

- A full registration slice looks like this:

  ```text
  Features/Authors/Registration/
  ├── Registration.ts
  ├── for_RegisterAuthor/when_registering/with_librarian_role.ts
  ├── RegisterAuthor.proxy.ts
  ├── RegisterAuthorForm.tsx
  └── for_RegisterAuthorForm/when_submitting/with_a_valid_name.tsx
  ```

  The listing slice has the same layout: `Listing.ts`, `for_Author/when_paging/`, its `*.proxy.ts` files, `AuthorCatalog.tsx`, and `for_AuthorCatalog/when_showing_a_page/`.
- `Features/Authors/Registration/Registration.ts` holds `RegisterAuthor`, `AuthorRegistered`, and `UniqueAuthorName`. `handle()` returns the event, and `@key()` identifies its event source. Chronicle enforces name uniqueness across author streams at append time. `AuthorName.ts` keeps the concept and its validator together.
- `Features/Authors/Listing/Listing.ts` maps the event to a projected `Author`. Its Arc queries load the Chronicle read models and subscribe to changes for the observable list. The book registration and listing slices follow the same pattern under `Features/Books/`.
- `Features/generatedMetadata.ts` and each slice's `*.proxy.ts` files are produced by `arc-proxygenerator` and committed beside their backend modules, as in Arc for .NET. Change the decorated source, then run `yarn workspace @cratis/arc.sample.library generate-proxies`; never edit generated files. The generator uses `--use-proxy-file-suffix`, writes no barrels in `Features`, and removes only stale owned files.
- `Features/Authors/Listing/AuthorCatalog.tsx` passes the co-located `./AllAuthors.proxy` observable query to `DataPage` from `@cratis/components/DataPage`. Its `Column` renders author names; `MenuItem` opens the registration dialog; selecting a row shows `AuthorBooks` in the details pane. `Features/Authors/Registration/RegisterAuthorForm.tsx` binds `InputTextField` from `@cratis/components/CommandForm` to `./RegisterAuthor.proxy` inside a `CommandDialog`. The dialog seeds the required id, executes the command, and closes on success. `Web/src/App.tsx` mounts `CratisComponentsProvider` inside `Arc`; `Web/src/main.tsx` imports the Components tokens, styles, and theme. The backend tsconfig excludes browser files, the web tsconfig includes components and frontend specs, and Vite serves slices outside `Web`. The web and frontend-spec Vite configs deduplicate React, React DOM, `@cratis/arc`, `@cratis/arc.react`, and `@cratis/components` across the app shell and slice imports. The slice package (`Samples/Library/package.json`) declares the frontend packages imported from `Features/`; `Web/package.json` declares the app shell's own dependencies. Components has no PrimeReact peer.

## Check it

```sh
yarn workspace @cratis/arc.sample.library build
yarn test --project library-frontend
yarn test
bash Samples/Library/run-integration.sh
```

The root Vitest workspace includes `vite.config.mts` for backend `for_*/when_*/*.ts` specs in Node and `vite.frontend.config.mts` for co-located frontend `for_*/when_*/*.tsx` specs in jsdom. Both projects use the shared Chai setup; frontend specs stub the query hook and generated command execution, then exercise Components interactions with Testing Library. Backend compilation and discovery ignore `for_*` folders and `.tsx` files; `Web/tsconfig.json` type-checks the frontend specs along with the components and proxies.

The integration script creates and removes **only its own** Chronicle development container, with bundled MongoDB. It exercises generated proxies over Express: author registration, uniqueness rejection, projected listings, book registration, and a live observable update. The `ChronicleCommandScenario` slice specs assert event appends without a kernel; only the live run checks the kernel's constraint and projection behavior. The browser UI is not exercised by the script.
