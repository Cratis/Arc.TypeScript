---
title: Keep a behavior together in a vertical slice
description: Keep backend artifacts, generated client proxies, and React components together in a vertical-slice folder.
---

When you change how an author registers, you should not have to hunt through separate command, validator, and event folders. Keep the behavior in a slice folder, with one TypeScript file named for that behavior:

```text
Features/Authors/
├── AuthorId.ts
├── AuthorName.ts
├── Registration/
│   ├── Registration.ts
│   ├── RegisterAuthor.proxy.ts
│   ├── RegisterAuthorForm.tsx
│   ├── for_RegisterAuthor/when_registering/with_librarian_role.ts
│   └── for_RegisterAuthorForm/when_submitting/with_a_valid_name.tsx
└── Listing/
    ├── Listing.ts
    ├── for_Author/when_paging/with_multiple_authors.ts
    ├── AllAuthors.proxy.ts
    ├── Author.proxy.ts
    ├── AuthorsPage.proxy.ts
    ├── AuthorCatalog.tsx
    └── for_AuthorCatalog/when_showing_a_page/with_authors.tsx
```

[`Registration.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Registration/Registration.ts) exports `RegisterAuthor`, `AuthorRegistered`, and the `UniqueAuthorName` Chronicle constraint. The concept and its validator live together in `AuthorName.ts`. [`Listing.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Listing/Listing.ts) exports the `Author` read model with its snapshot and observable queries. `AuthorId` and `AuthorName` live one level up because other slices use them. The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/Registration.ts) follows the same layout.

This is an **application convention**, not a requirement of the Arc runtime. The [C# Library registration slice](https://github.com/Cratis/Samples/blob/main/Library/Lending/Authors/Registration/Registration.cs) puts `RegisterAuthor`, `AuthorRegistered`, and `UniqueAuthorName` in `Registration.cs`; [Studio's registration slice](https://github.com/Cratis/Studio/blob/main/Source/Core/Projects/Registration/Registration.cs) also keeps its command, constraint, and event together. In a Chronicle TypeScript slice, place its event alongside the command, give it a constructor and `@field` declarations, and return an event instance from `handle()` as Library does. Arc without Chronicle needs no event; Tasks demonstrates that path.

Discover the **folder**, not a single class: `await builder.discover(new URL('./Features/', import.meta.url))` registers every exported, decorated artifact in each backend module. Discovery ignores `*.proxy.ts`, `*.proxy.js`, and React `.tsx` files. The [proxy generator](proxy-generation/index.md) reads every exported command and read-model declaration in a file and writes one browser proxy **per operation**, next to the backend file it mirrors. It also records each exported validator in [generated metadata](proxy-generation/generated-artifact-metadata.md). The [Arc ESLint rules](code-analysis/index.md) check backend artifacts but exclude generated proxies. Give components names for what they render (`RegisterAuthorForm.tsx`), not the same basename as a backend `.ts` module; TypeScript silently drops one of those two files from a compilation.

After you add or change a slice, regenerate the proxies and metadata with `arc-proxygenerator --artifacts Features --output Features --use-proxy-file-suffix` (use absolute paths in a script). Co-located generation skips barrels automatically. Exclude `**/*.proxy.ts`, `**/*.tsx`, and `**/for_*/**` from the backend tsconfig; include proxies, components, and frontend `.tsx` specifications in the web tsconfig. The root `yarn test` uses two Library Vitest projects: `vite.config.mts` runs backend `for_*/when_*/*.ts` specs in Node with the backend decorator transform, while `vite.frontend.config.mts` runs only frontend `for_*/when_*/*.tsx` specs in jsdom with the same transform. Both use the shared Chai setup; browser specs stub the query hook and command execution and use Testing Library to exercise the co-located `DataPage` and registration dialog without a live kernel. The proxy generator and backend discovery skip `for_*` folders, proxies, and React files, so browser specs never enter the backend build or artifact scan. Let backend lint run on the slice folder. Never hand-edit generated metadata or browser proxies; change the decorated source and regenerate. A separate generated folder remains an [alternative](proxy-generation/getting-started.md#separate-output-folders).

The Library sample uses `@cratis/components` **inside** the slices: [`AuthorCatalog.tsx`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Listing/AuthorCatalog.tsx) passes `AllAuthors` to `<DataPage query={AllAuthors}>` with a `Column` and an Add `MenuItem`; [`RegisterAuthorForm.tsx`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Registration/RegisterAuthorForm.tsx) uses `CommandDialog` and a bound `InputTextField` with `RegisterAuthor`. `Web/src/App.tsx` wraps the page in `Arc` and `CratisComponentsProvider`; `Web/src/main.tsx` imports Components CSS. The dependency lives in `Web/package.json`, where the Library workspace makes it available to `Features/`. Both Vite configs deduplicate `react`, `react-dom`, `@cratis/arc`, `@cratis/arc.react`, and `@cratis/components` so co-located hooks, providers, and the app shell share one runtime. Components 4's built-in renderer needs no PrimeReact dependency.

Framework implementations under `Source/` use one type per file instead; this layout is for application code and documentation examples. Working on the samples in this repository has its own scripts, listed in [Change a sample](contributing/samples.md).
