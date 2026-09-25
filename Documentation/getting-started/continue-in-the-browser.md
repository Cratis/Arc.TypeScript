---
title: Continue in the browser
description: Generate typed proxies from the Tasks sample, call its command from a React form, and watch an observable query update the page without a reload.
---

The Tasks server answers `curl`. A real user needs a page, and the usual next step is a hand-written `fetch` for every endpoint: a URL string, a body type that mirrors the server's fields, and a copy of the validation rules so the form can complain before submitting. All of that drifts the first time someone renames a field on the server.

Arc generates that client for you. The proxy generator reads the same classes the server serves and writes a typed TypeScript class per command and query, with the route, the fields, the client-safe validation rules, and a React hook. You write the page; the proxies keep it in step with the server.

In this lesson you create a small Vite and React app beside your clone, generate the Tasks proxies into it, and build one page that registers tasks and shows a live list. By the end, a task you register appears in the list without a reload.

## Before you start

Finish [Get started](index.md) first, and keep the Tasks server running on `127.0.0.1:3000`. You also need `npm`.

The browser side uses the published client packages `@cratis/arc` and `@cratis/arc.react` 22.19.1, the same versions the Library sample uses. They are the Arc frontend packages, released from the Arc repository; the generator in this repository targets them.

## Create the web app

From the folder that contains your `Arc.TypeScript` clone, create a sibling folder:

```bash
mkdir -p tasks-web/src/generated
cd tasks-web
```

Create `package.json`:

```json title="tasks-web/package.json"
{
  "name": "tasks-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@cratis/arc": "22.19.1",
    "@cratis/arc.react": "22.19.1",
    "@cratis/fundamentals": "7.19.6",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "reflect-metadata": "0.2.2",
    "tsyringe": "^4.10.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "typescript": "^7.0.2",
    "vite": "^8.2.2"
  }
}
```

Create `tsconfig.json`. The generated models use legacy decorators, so `experimentalDecorators` and `emitDecoratorMetadata` are required:

```json title="tasks-web/tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `vite.config.ts`. The dev server forwards API calls and the live-query connection to the Tasks server, so the browser talks to one origin:

```typescript title="tasks-web/vite.config.ts"
import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': { target: 'http://127.0.0.1:3000' },
            '/.cratis': { target: 'http://127.0.0.1:3000', ws: true }
        }
    }
});
```

Create `index.html`:

```html title="tasks-web/index.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Tasks</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Then install:

```bash
npm install
```

## Generate the proxies

Go back to your clone and run the generator against the Tasks sample, writing into the web app's `src/generated` folder:

```bash
cd ../Arc.TypeScript
node Source/Tools/ProxyGenerator/dist/cli.js \
  --project "$PWD/Samples/Tasks/tsconfig.json" \
  --artifacts "$PWD/Samples/Tasks/Features" \
  --output "$PWD/../tasks-web/src/generated" \
  --use-generated-metadata \
  --use-proxy-file-suffix
```

The generator prints `Generated 7 changed file(s)`. It also prints one note, `Server-only validator rule on value`, for the `TaskTitleValidator` rule: a `must(...)` callback is code, and code does not travel to the browser. You now have:

```text
src/generated/Tasks/Listing/AllTasks.proxy.ts
src/generated/Tasks/Listing/ObserveAllTasks.proxy.ts
src/generated/Tasks/Listing/TaskById.proxy.ts
src/generated/Tasks/Listing/TaskItem.proxy.ts
src/generated/Tasks/Listing/index.ts
src/generated/Tasks/Registration/RegisterTask.proxy.ts
src/generated/Tasks/Registration/index.ts
```

The generator never imported or ran the server. It read the TypeScript source with the compiler API. Here is the heart of `RegisterTask.proxy.ts`:

```typescript
export class RegisterTaskValidator extends CommandValidator<IRegisterTask> {
    constructor() {
        super();
        this.ruleFor(c => c.title).notEmpty().withMessage('A title is required');
        this.ruleFor(c => c.title).maxLength(100).withMessage('A title can have at most 100 characters');
    }
}

export class RegisterTask extends Command<IRegisterTask, Guid> implements IRegisterTask {
    readonly route: string = '/api/tasks/registration/register-task';
    readonly validation: CommandValidator = new RegisterTaskValidator();
```

The route matches the server's. The `notEmpty` and `maxLength` rules came across from `RegisterTaskValidator`, word for word. The `TaskId` concept arrives as a `Guid` and `TaskTitle` as a `string`, because concepts travel as their underlying value. Do not edit these files; regenerate them when the server changes.

## Build the page

Create `src/TaskBoard.tsx`:

```tsx title="tasks-web/src/TaskBoard.tsx"
import { useState, type FormEvent } from 'react';
import { Guid } from '@cratis/fundamentals';
import { RegisterTask } from './generated/Tasks/Registration/RegisterTask.proxy';
import { ObserveAllTasks } from './generated/Tasks/Listing/ObserveAllTasks.proxy';

export function TaskBoard() {
    const [registerTask, setValues] = RegisterTask.use();
    const [tasks] = ObserveAllTasks.use();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setValues({ id: Guid.create(), title });
        const result = await registerTask.execute();
        if (result.isSuccess) {
            setTitle('');
            setMessage('Task registered.');
        } else {
            setMessage(result.validationResults.map(item => item.message).join(' '));
        }
    };

    return <main>
        <h1>Tasks</h1>
        <form onSubmit={event => void submit(event)}>
            <label htmlFor="title">Title</label>
            <input id="title" value={title} onChange={event => setTitle(event.target.value)} />
            <button type="submit">Register task</button>
            <p role="status">{message}</p>
        </form>
        <p>{tasks.data.length} tasks</p>
        <ul>{tasks.data.map(task => <li key={String(task.id)}>{task.title}</li>)}</ul>
    </main>;
}
```

Two hooks do the work:

- `RegisterTask.use()` returns the command instance and a setter. `setValues` writes the fields onto the instance immediately, so the next line can `execute()` it. The result has the same `isSuccess` and `validationResults` you saw with `curl`.
- `ObserveAllTasks.use()` subscribes to the observable query and returns its current result. `tasks.data` starts as an empty array and re-renders the component every time the server's list changes.

Create `src/main.tsx`:

```tsx title="tasks-web/src/main.tsx"
import 'reflect-metadata';
import { createRoot } from 'react-dom/client';
import { Arc } from '@cratis/arc.react';
import { QueryTransportMethod } from '@cratis/arc/queries';
import { TaskBoard } from './TaskBoard';

createRoot(document.getElementById('root')!).render(
    <Arc queryTransportMethod={QueryTransportMethod.WebSocket}>
        <TaskBoard />
    </Arc>
);
```

`<Arc>` gives every hook below it the same configuration: the API origin (here the page's own origin, which Vite forwards) and how live queries travel.

:::caution[Choose the WebSocket hub for an anonymous server]
`<Arc>` connects live queries through the server-sent events hub by default. On this server the SSE hub requires an authenticated caller, and the Tasks sample has no authentication, so the list would stay empty while the browser console reports `SSE hub connection error`. `queryTransportMethod={QueryTransportMethod.WebSocket}` uses the WebSocket hub at `/.cratis/queries/ws`, which accepts anonymous callers. An application with real sign-in can keep the default; see [Multiplexed observable queries](../queries/observable-query-demultiplexer.md).
:::

## Run it

In the `tasks-web` folder, check the types and start the dev server:

```bash
npm run typecheck
npm run dev
```

Open <http://127.0.0.1:5173>. The list shows any tasks you registered with `curl` earlier. Now try three titles:

| You type | The status line shows | What happened |
| --- | --- | --- |
| Nothing | `A title is required` | The proxy's copy of the rule failed in the browser; no request was sent |
| `!Loud` | `A title cannot begin with an exclamation mark` | The browser had no copy of this rule, so the server checked it and answered 400 |
| `Try the browser` | `Task registered.` | The command succeeded, and the list grows by one without a reload |

The last row is the observable query at work. The WebSocket hub subscribed to `observeAllTasks` when the page loaded. When `handle()` called `tasks.register(...)`, the sample's `BehaviorSubject` emitted the new list, Arc pushed it over the open connection, and the hook re-rendered the page. Register a task with `curl` from another terminal and it appears in the browser too.

## Recap

You generated a typed client from the server's source, called a command from a form with `RegisterTask.use()`, and kept a list live with `ObserveAllTasks.use()`. Simple rules ran in the browser, rules written as code ran on the server, and both reported through the same result shape. When the server's command or query changes, run the generator again and TypeScript tells you which parts of the page no longer fit.

## Next step

- [Proxy generation](../proxy-generation/index.md) covers every generator option, including `--watch` for a development loop.
- [Observable queries](../queries/observable-queries.md) explains sources, snapshots, paging, and authorization for live queries.
- [Explore the Library sample](library-sample.md) shows a larger React app with paging, authorization, and Chronicle.
- The shared [Arc frontend documentation](/arc/frontend/) covers the client packages in depth.
