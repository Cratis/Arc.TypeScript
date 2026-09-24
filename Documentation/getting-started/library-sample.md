<!-- Copyright (c) Cratis. All rights reserved. Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Explore the Library sample

What does an Arc feature look like when it reaches a browser? The Library sample takes the authors and books from the [shared tutorial](https://www.cratis.io/arc/tutorial/first-slice/) and makes the whole path visible: a command writes an author, an observable query publishes the changed list, and a React hook redraws it. No Chronicle or database is needed for your first run.

:::caution[Source preview]
Arc for TypeScript server packages are still source-preview packages. Run this sample inside a clone of the repository. Its fixed librarian identity is for local demonstration only; never expose this server publicly.
:::

## Open your library

With Node.js 22.19 or later and Yarn 4 installed, run from the repository root:

```sh
yarn install
yarn workspace @cratis/arc.sample.library dev
```

Visit <http://127.0.0.1:5173>. Register an author, select their name, and add a book. The author count and paged list update through the live query without a refresh. Books appear on the selected author's shelf after the command succeeds. Stop the dev process with Ctrl+C.

If the port is occupied, free ports 3000 and 5173 first. Vite sends `/api` and `/.cratis` requests to Express on loopback; opening only the Vite page without the backend cannot serve commands or queries.

## Trace one feature

Start with [`RegisterAuthor.ts`](../../Samples/Library/Features/Authors/Registration/RegisterAuthor.ts). Its `handle(authors: Authors, context: CommandContext)` receives bindings from generated metadata, and `@key()` marks the author id used in the command context. The command validator checks duplicates; `AuthorNameValidator` guards the name wherever it appears. `@roles('Librarian')` requires an authenticated librarian. The local Express host supplies a fixed, trusted demonstration principal, **not** an authentication mechanism.

Next read [`Author.ts`](../../Samples/Library/Features/Authors/Listing/Author.ts): `allAuthors` is observable and `authorsPage` is a snapshot query. Arc handles paging for that small list. In [`Web/src/Features/Authors/Listing/AuthorCatalog.tsx`](../../Samples/Library/Web/src/Features/Authors/Listing/AuthorCatalog.tsx), the generated `AllAuthors.use()` keeps the catalog live while `AuthorsPage.useWithPaging(5)` drives the page buttons. The book command and filtered query live together under `Features/Books/`.

The source generator produces both server metadata and browser proxies. When you change a command or query, regenerate rather than editing `generatedMetadata.ts` or `Web/src/generated/` by hand. The [`sample README`](../../Samples/Library/README.md) explains the build, verification, and MongoDB option.

## Keep or replace the data

The default service keeps records in memory; restarting the backend clears them. Set `MONGODB_URL` to switch those services to Arc's MongoDB collections. MongoDB live observation needs a replica set with change streams. The paged snapshot loads the small catalog before Arc pages it in either mode, so do not use this implementation for an unbounded production list. The smoke test checks the in-memory Express and generated-client round trip, not MongoDB or browser interaction.

You have now traced a command from a typed React hook through Express into storage, then back through an observable query. [Your first command](your-first-command.md) walks the smaller Tasks sample file by file if you want to isolate each decorator.
