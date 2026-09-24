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

Without `MONGODB_URL`, authors and books live in application memory and disappear on restart. To use MongoDB instead, set `MONGODB_URL` before starting. **Live author queries require a MongoDB replica set with change streams**; a standalone server can store records but cannot emit the live list. The MongoDB and in-memory modes both use the `Authors` and `Books` service classes. This sample's author page is paged by Arc after loading the list into memory; it is intended for a small catalog, not an unbounded production collection.

The backend assigns a fixed `Librarian` principal inside the loopback-only Express host to demonstrate `@roles('Librarian')` on `RegisterAuthor`. It does not authenticate visitors. Do not expose this host publicly or copy that principal into production; connect a real host-verified identity before deployment.

## Follow the code

- `Features/Authors/Registration/RegisterAuthor.ts` holds a command with `@key()` and an injected `CommandContext`; its validator rejects duplicate names. `AuthorNameValidator` enforces the value's own rules.
- `Features/Authors/Listing/Author.ts` serves both the live list and the paged snapshot. `Features/Books/Registration` and `Features/Books/Listing` add and read books by author id.
- `Features/generatedMetadata.ts` and `Web/src/generated/` are produced by `arc-proxygenerator`. Change the decorated source, then regenerate; never edit generated files.
- `Web/src/Features/` uses the generated `.use()` hooks. The author list is observable, the page controls request five authors at a time, and the filtered book query updates that author's shelf live.

## Check it

```sh
yarn workspace @cratis/arc.sample.library build
yarn workspace @cratis/arc.sample.library test:e2e
yarn ci
```

The smoke test starts the compiled Express server in memory mode and runs generated command and query proxies against the real HTTP listener. It does not test MongoDB or a browser UI. The slice specifications run through `CommandScenario` and `QueryScenario` in `yarn ci`.
