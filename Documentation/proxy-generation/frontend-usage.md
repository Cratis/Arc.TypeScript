---
title: Use generated proxies in React
description: Execute generated commands, show snapshot and live queries, page and sort results, and pass query arguments from React components, following the Library sample.
---

The Library sample's frontend registers authors, lists them live, pages through them five at a time, and shows each author's books. None of it contains a URL, a `fetch` call, or a hand-written response type. Every component talks to the backend through a proxy from [Set up proxy generation](getting-started.md).

This page walks through those components. The excerpts come from [`Samples/Library/Web/src`](https://github.com/Cratis/Arc.TypeScript/tree/main/Samples/Library/Web/src) with the license header removed, and use `@cratis/arc` and `@cratis/arc.react` 22.19.1.

## Wrap the application in Arc

```tsx title="Web/src/App.tsx"
import { Arc } from '@cratis/arc.react';
import { RegisterAuthorForm } from './Features/Authors/Registration/RegisterAuthorForm';
import { AuthorCatalog } from './Features/Authors/Listing/AuthorCatalog';

export function App() {
    return <Arc><main>
        <header><span className="eyebrow">CRATIS · ARC FOR TYPESCRIPT</span><h1>The Library</h1>
            <p>Make room for a new story. Register an author, then fill their shelf.</p></header>
        <div className="layout"><section className="card"><h2>Register an author</h2><RegisterAuthorForm /></section>
            <section className="card catalog"><h2>Authors &amp; books</h2><AuthorCatalog /></section></div>
    </main></Arc>;
}
```

`Arc` configures the client once: where requests go, which headers they carry, and how observable queries connect. The generated hooks read that configuration, so a proxy never needs a base URL. The Library frontend runs on the Vite dev server, which proxies `/api` and `/.cratis` to the backend, so every request is same-origin.

## Execute a command

```tsx title="Web/src/Features/Authors/Registration/RegisterAuthorForm.tsx"
import { useState, type FormEvent } from 'react';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from '../../../generated/Authors/Registration/RegisterAuthor.proxy';

export function RegisterAuthorForm() {
    const [command, setValues] = RegisterAuthor.use();
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setValues({ id: Guid.create(), name: name.trim() });
        // Setters update the command instance before execution; use the instance itself for the result.
        const result = await command.execute();
        if (result.isSuccess) { setName(''); setMessage('Author registered.'); }
        else setMessage(result.validationResults.map(item => item.message).join(' ') || 'Registration failed.');
    };
    return <form onSubmit={event => void submit(event)}><label htmlFor="author-name">Name</label>
        <input id="author-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Octavia Butler" required />
        <button type="submit">Register author</button><p role="status">{message}</p></form>;
}
```

`RegisterAuthor.use()` returns the command instance and a setter. `setValues` writes the properties onto that instance, and `execute()` sends it to `/api/authors/registration/register-author`.

Before any request leaves the browser, `execute()` runs the client-side rules the generator copied from the backend's validators. An empty name fails right here with the backend's own message, "An author name is required". Only valid input reaches the server, which runs authorization, validation, and `handle()` again. Either way you get one `CommandResult`: `isSuccess`, `validationResults`, `isAuthorized`, and, for a command that returns a value, `response`.

## Show a live list

```tsx title="Web/src/Features/Authors/Listing/AuthorCatalog.tsx (excerpt)"
const [live] = AllAuthors.use();
```

`allAuthors` returns an RxJS `Observable` on the server, so its proxy is an observable query. `AllAuthors.use()` subscribes when the component mounts and unsubscribes when it unmounts. `live.data` is always an array of `Author`, starting from the generated `defaultValue` of `[]`, and every new author registered anywhere appears without a reload.

The client keeps one connection to the server's observable query hub and multiplexes every live query over it. [Observable queries](../queries/observable-queries.md) covers the server side, and the shared [React observable queries](/arc/frontend/react/queries/observable-queries/) page covers transport options.

## Page and sort a snapshot

```tsx title="Web/src/Features/Authors/Listing/AuthorCatalog.tsx (excerpt)"
const [page, performPage, , setPage] = AuthorsPage.useWithPaging(5, AuthorsPage.sortBy.name.ascending);
useEffect(() => { void performPage(); }, [live.data.length]);
```

`authorsPage` returns a plain array, so its proxy is a snapshot query. `useWithPaging(5, ...)` asks the server for five authors at a time, sorted by name. The generator emits a `sortBy` helper with one entry per model field, so a misspelled sort field is a compile error.

The tuple is `[result, perform, setSorting, setPage, setPageSize]`; this component skips `setSorting`. `page.paging` carries `page`, `size`, `totalItems`, and `totalPages`, which drive the Previous and Next buttons:

```tsx
<button disabled={page.paging.page === 0} onClick={() => setPage(page.paging.page - 1)}>Previous</button>
```

A snapshot does not update by itself. The effect re-runs `performPage` whenever the live list changes length, so the paged view follows new registrations.

## Pass query arguments

```tsx title="Web/src/Features/Books/Listing/AuthorBooks.tsx (excerpt)"
export function AuthorBooks({ authorId }: { authorId: Guid }) {
    const [books] = BooksForAuthor.use({ authorId });
```

`booksForAuthor(authorId: AuthorId, ...)` takes an argument, so the generator emits a `BooksForAuthorParameters` interface and `use(args)` takes it first. The server's `AuthorId` concept arrives in the frontend as its underlying `Guid`. When `authorId` changes, the hook subscribes with the new argument.

## Follow individual changes

An observable query that returns a list also gets `useChangeStream(args?, getKey?, sorting?)`. It returns a `ChangeSet` with the items added, replaced, and removed since the last emission, instead of the whole list. Use it when a component animates or reconciles rows. See the shared [change stream](/arc/frontend/react/queries/change-stream/) page.

## Recap

- `Command.use()` gives an instance you fill and `execute()`; client rules run before the request.
- `Query.use()` returns `[result, ...]`: a snapshot for plain returns, a live subscription for observables.
- `useWithPaging(pageSize, sorting)` and the generated `sortBy` helpers page and sort on the server.
- Arguments go in a generated parameters object, typed from the server's method signature.

For every hook signature, read [What the generator writes](generated-code.md). The shared React pages go further into [commands](/arc/frontend/react/commands/react-usage/), [queries](/arc/frontend/react/queries/usage/), and [paging](/arc/frontend/react/queries/paging/).
