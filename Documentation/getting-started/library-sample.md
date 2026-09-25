---
title: Explore the Library sample
description: Run the event-sourced Library sample against a local Chronicle kernel, then trace one feature from command to event, projection, and a live React view.
---

What does an event-sourced Arc feature look like when it reaches a browser? The Library sample takes the authors and books from the [shared tutorial](/arc/tutorial/first-slice/) and makes the whole path visible: a command returns an event, Chronicle appends it and projects the read model, and an observable query updates the React view.

:::caution[Source preview]
Arc for TypeScript server packages and their Chronicle integration are experimental source-preview packages. Run this sample inside a clone of the repository, against your own development Chronicle kernel. Its fixed librarian identity is for local demonstration only; never expose this server publicly.
:::

## Open your library

With Node.js 22.19 or later, Yarn 4, and Docker installed, run from the repository root:

```sh
yarn install
docker compose -f Samples/Library/docker-compose.yml up -d
yarn workspace @cratis/arc.sample.library dev
```

Visit <http://127.0.0.1:5173>. Register an author, select their name, and add a book. After Chronicle projects the event, the author count and list update without a refresh. The book appears on the selected author's shelf. Stop the dev process with Ctrl+C, then stop this sample's kernel with `docker compose -f Samples/Library/docker-compose.yml down --volumes`. That removes the container and the volumes of its bundled MongoDB, and with them the development data.

Vite sends `/api` and `/.cratis` requests to Express on loopback. If the ports are occupied, free ports 3000, 5173, and 35000 before starting.

## Trace one feature

Start with [`Registration.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Registration/Registration.ts). `RegisterAuthor.handle()` returns `new AuthorRegistered(this.name)`; Arc appends it to the event source marked by `@key()`. `UniqueAuthorName` defines a Chronicle append-time constraint across author streams, while the concept validator beside [`AuthorName`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/AuthorName.ts) checks the name's shape. `@roles('Librarian')` requires an authenticated librarian. The local Express host supplies a fixed, trusted demonstration principal, **not** an authentication mechanism.

Next read [`Listing.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Listing/Listing.ts): `@fromEvent(AuthorRegistered)` builds the projected read model, `allAuthors` watches Chronicle changes, and `authorsPage` loads a snapshot. Arc handles paging for that small list. In [`AuthorCatalog.tsx`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Web/src/Features/Authors/Listing/AuthorCatalog.tsx), the generated `AllAuthors.use()` keeps the catalog live while `AuthorsPage.useWithPaging(5)` drives the page buttons. The book slices sit under `Features/Books/`. See [Vertical slices](../vertical-slices.md) for the TypeScript layout alongside the C# version.

The source generator produces both server metadata and browser proxies. When you change a command or query, regenerate rather than editing `generatedMetadata.ts` or `Web/src/generated/` by hand. The [`sample README`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/README.md) explains configuration and verification.

## What the kernel does

`appsettings.json` configures `Cratis.Chronicle` with the `Library` event store and a local development connection string. The compose image bundles MongoDB as Chronicle's event store and read-model sink; the application never writes to MongoDB directly. A successful append may precede the projected query update. The sample loads the small catalog before Arc pages it, so do not use that query for an unbounded production list. `bash Samples/Library/run-integration.sh` starts its own Chronicle container and tests the generated proxy HTTP round trip, including uniqueness and an observable update. It does not exercise the browser UI.

You have now traced a typed React hook through Express into Chronicle and back through a projected observable query. To build the same loop in a project of your own, [create an application](create-an-application.md) and then [add event sourcing](../chronicle/add-event-sourcing.md) to it. [Your first command](your-first-command.md) walks the smaller, infrastructure-free Tasks sample if you want to isolate the Arc decorators.
