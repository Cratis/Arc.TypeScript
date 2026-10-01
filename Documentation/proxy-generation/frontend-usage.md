---
title: Use generated proxies in React
description: Execute generated commands, show live queries with Cratis Components, and pass query arguments from co-located React slices.
---

The [Library sample](https://github.com/Cratis/Arc.TypeScript/tree/main/Samples/Library) registers authors, lists them live, and shows each author's books. Its React components sit beside the backend slices under `Features/`; `Web/src` holds the app shell. None of the components contains a URL, a `fetch` call, or a hand-written response type. The snippets below omit the license header and use `@cratis/arc` and `@cratis/arc.react` 22.44.0 with `@cratis/components` 4.22.1.

```text
Features/Authors/Registration/
├── Registration.ts
├── for_RegisterAuthor/when_registering/with_librarian_role.ts
├── RegisterAuthor.proxy.ts
├── RegisterAuthorForm.tsx
└── for_RegisterAuthorForm/when_submitting/with_a_valid_name.tsx
```

`yarn test` runs backend `.ts` specs in Node and frontend `.tsx` specs in jsdom. The web tsconfig includes both the components and their specs; backend compilation and artifact discovery ignore frontend files and generated proxies. `Samples/Library/package.json` declares the frontend packages imported by the slices (`@cratis/components`, `@cratis/arc`, and `@cratis/arc.react`); `Web/package.json` declares its own app-shell dependencies. Vite 8 reads the nearest tsconfig for each proxy in `Features/`, not the web tsconfig, so `Web/vite.config.ts` sets `oxc: { decorator: { legacy: true } }`. Other bundlers reading slices outside the web project also need a legacy decorator transform. The web and frontend-test Vite configs deduplicate React, React DOM, Arc, Arc React, and Components across `Web/src` and `Features/`. Components 4's built-in renderer does **not** require PrimeReact.

## Mount the providers and styles once

```tsx title="Web/src/App.tsx"
import { Arc } from '@cratis/arc.react';
import { CratisComponentsProvider } from '@cratis/components';
import { AuthorCatalog } from '../../Features/Authors/Listing/AuthorCatalog';

export function App() {
    return <Arc><CratisComponentsProvider value={{ locale: 'en-US' }} toaster><main>
        <header><span className="eyebrow">CRATIS · ARC FOR TYPESCRIPT</span><h1>The Library</h1>
            <p>Make room for a new story. Register an author, then fill their shelf.</p></header>
        <AuthorCatalog />
    </main></CratisComponentsProvider></Arc>;
}
```

`Arc` configures requests, headers, and observable connections once. `CratisComponentsProvider` supplies component labels and notifications; it goes inside `Arc`, not instead of it. `Web/src/main.tsx` imports `reflect-metadata`, `@cratis/components/tokens`, `@cratis/components/styles`, and `@cratis/components/theme` once before mounting `App`. Vite proxies `/api` and `/.cratis` to the backend, so requests stay same-origin.

## Register an author from a co-located command dialog

```tsx title="Features/Authors/Registration/RegisterAuthorForm.tsx"
import { DialogResult, useDialogContext } from '@cratis/arc.react/dialogs';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from './RegisterAuthor.proxy';

export function RegisterAuthorForm() {
    const { closeDialog } = useDialogContext();
    return <CommandDialog<RegisterAuthor> command={RegisterAuthor} title="Register an author" okLabel="Register author"
        initialValues={{ id: Guid.create() }}
        onBeforeExecute={command => { command.name = command.name.trim(); return command; }}
        onSuccess={() => closeDialog(DialogResult.Ok)} onCancel={() => closeDialog(DialogResult.Cancelled)}>
        <InputTextField<RegisterAuthor> value={command => command.name} title="Name" placeholder="e.g. Octavia Butler" />
    </CommandDialog>;
}
```

The `InputTextField` accessor binds directly to the generated command property. The dialog runs validation and command execution and stays open on failure. Seed the required id with `initialValues` **before** validation; `onBeforeExecute` is only for the trim transform, after validation has enabled submit. An empty name fails client validation with the backend validator's message, "An author name is required"; the server checks authorization, validation, and `handle()` again. `onSuccess` closes the dialog only after successful execution. The generated `RegisterAuthor.proxy.ts` is never hand-edited.

## Show an observable list and open the dialog

```tsx title="Features/Authors/Listing/AuthorCatalog.tsx (excerpt)"
const [selected, setSelected] = useState<Author | null>(null);
const [RegistrationDialog, showRegistration] = useDialog(RegisterAuthorForm);

return <div className="catalog-page">
    <DataPage title="Authors & books" query={AllAuthors} emptyMessage="No authors yet." dataKey="id"
        selection={selected} onSelectionChange={event => setSelected(event.value)} detailsComponent={AuthorShelf}>
        <DataPage.MenuItems><MenuItem label="Add author" command={() => { void showRegistration(); }} /></DataPage.MenuItems>
        <DataPage.Columns><Column field="name" header="Name" sortable /></DataPage.Columns>
    </DataPage>
    <RegistrationDialog />
</div>;
```

`AuthorCatalog.tsx` imports `DataPage`, `MenuItem`, and `Column` from `@cratis/components/DataPage`, `useDialog` from `@cratis/arc.react/dialogs`, and `AllAuthors` from `./AllAuthors.proxy`. `DataPage` subscribes through the generated observable query proxy and supplies paging, sorting, selection, and an Add toolbar action. `dataKey` identifies rows. The selected author is passed to `AuthorShelf`, which renders `AuthorBooks`; the latter subscribes to the co-located `BooksForAuthor` proxy with `{ authorId }`. The `catalog-page` container has a bounded height so the data table and details pane can size themselves. Neither the list nor the dialog needs a hand-rolled table, modal, or fetch.

`allAuthors` returns an RxJS `Observable` on the server. Its proxy starts with an empty array and receives updates as the projection changes. The client multiplexes live queries over one connection. [Observable queries](../queries/observable-queries.md) covers the server side, and the shared [React observable queries](/arc/frontend/react/queries/observable-queries/) page covers transport options.

## Use a snapshot when live updates are unnecessary

`AuthorsPage.proxy.ts` in the same listing slice demonstrates a snapshot query. Its generated `useWithPaging(5, AuthorsPage.sortBy.name.ascending)` hook returns `[result, perform, setSorting, setPage, setPageSize]`, and `result.paging` contains page, size, total items, and total pages. For a Components page, pass `AuthorsPage` as the `DataPage` `query` prop instead of `AllAuthors`: `DataPage` selects the snapshot table and handles paging itself. A snapshot needs a refresh after a command; the observable `AllAuthors` used by the actual Library page updates automatically. The sample's snapshot loads the small catalog before Arc pages it; do not copy that backend query for an unbounded production list.

## Follow individual changes

An observable query returning a list also gets `useChangeStream(args?, getKey?, sorting?)`. It returns a `ChangeSet` with the items added, replaced, and removed since the last emission, instead of the whole list. Use it when a component animates or reconciles rows. See the shared [change stream](/arc/frontend/react/queries/change-stream/) page.

For every generated hook signature, read [What the generator writes](generated-code.md). The shared React pages go further into [commands](/arc/frontend/react/commands/react-usage/), [queries](/arc/frontend/react/queries/usage/), and [paging](/arc/frontend/react/queries/paging/).
