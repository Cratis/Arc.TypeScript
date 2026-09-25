---
title: Create an Arc application from an empty folder
description: Build the Arc packages from a clone, install them into a new Node.js project, and run your own command and query with generated metadata and a watch loop.
---

You have seen the Tasks sample and want a project of your own. `npm install @cratis/arc.core` fails, because nothing from this repository is published to npm yet. This guide takes an empty folder to a running Arc server using packages you build from a clone.

When you finish, a small notes API listens on `127.0.0.1:3000`. `POST /api/notes/writing/write-note` stores a note, refuses one without text, and `GET /api/notes/listing/all-notes` returns what you stored. The server reloads when you edit the code.

:::caution[Source preview]
Arc for TypeScript is an unpublished source preview, and its API may still change. Check the [capability reference](../reference/capabilities.md) before you rely on a feature in a larger application.
:::

## Before you start

You need Node.js 22.19 or later, Git, Corepack, npm, and `curl`. Node.js 25 and later no longer include Corepack; if `corepack enable` reports that the command is not found, run `npm install --global corepack` first.

There are two ways to consume packages that are not on npm:

| Path | Your project lives | Use it when |
| --- | --- | --- |
| [Packed tarballs](#build-and-pack-the-packages) | In any folder, with its own `package.json` and lockfile | You want a separate repository. This guide follows this path |
| [Inside the clone](#work-inside-the-clone-instead) | Under `Samples/` in your clone of this repository | You are experimenting, or you change Arc itself while you build on it |

A dependency written as `workspace:^`, as in the samples, resolves only inside this repository's Yarn workspace. In a project of your own it fails at install.

## Build and pack the packages

Clone and build the repository:

```bash
git clone https://github.com/Cratis/Arc.TypeScript.git
cd Arc.TypeScript
corepack enable
yarn install
yarn build
```

Pack the core and the proxy generator into a folder next to the clone:

```bash
mkdir -p ../arc-packages
yarn workspace @cratis/arc.core pack --out "$PWD/../arc-packages/arc.core.tgz"
yarn workspace @cratis/arc.proxygenerator pack --out "$PWD/../arc-packages/arc.proxygenerator.tgz"
```

Use `yarn pack`, not `npm pack`. Yarn rewrites the internal `workspace:^` dependencies to version ranges as it packs. `npm pack` copies them unchanged, and the tarball then fails to install. Pack an adapter or integration the same way when you need it; [Packages](../reference/packages.md) lists the workspace names.

After you pull a newer version of the repository, run `yarn build` and the pack commands again. Then repeat the two `npm install` commands from the next section in your project. A plain `npm install` keeps the package contents it installed before, because the tarball path and version have not changed.

## Create the project

Start with an empty folder next to the packages:

```bash
cd ..
mkdir my-arc-app
cd my-arc-app
```

Create `package.json`:

```json title="package.json"
{
  "name": "my-arc-app",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.19.0"
  },
  "scripts": {
    "generate": "node generate.mjs",
    "build": "npm run generate && tsc6",
    "start": "node dist/main.js",
    "dev": "tsx watch main.ts"
  }
}
```

Arc packages are ES modules only, so the project needs `"type": "module"`. Install the tarballs and their peer dependencies, then the development tools:

```bash
npm install ../arc-packages/arc.core.tgz @cratis/fundamentals@^7.19.6 @opentelemetry/api@^1.9.0
npm install --save-dev ../arc-packages/arc.proxygenerator.tgz typescript@npm:@typescript/typescript6@^6.0.2 @types/node@^22 tsx
```

npm records the tarballs as `file:../arc-packages/...` dependencies. `typescript` is pinned to TypeScript 6, the compiler this repository and the proxy generator use. That package installs its compiler command as `tsc6`, which is why the `build` script calls `tsc6`. Recent npm versions may report that they blocked install scripts for `esbuild` (and `fsevents` on macOS); `tsx` runs without them.

Create `tsconfig.json`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "ESNext.Decorators"],
    "types": ["node"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["main.ts", "Features/**/*.ts"]
}
```

| Setting | Why |
| --- | --- |
| No `experimentalDecorators` | Compiles Arc's decorators as standard TC39 decorators, as the samples do. `ESNext.Decorators` in `lib` declares the `Symbol.metadata` they use. Legacy decorators also work; see [Decorator modes](../dependency-injection.md#decorator-modes) |
| `NodeNext` | Node runs the emitted ES modules directly. Write relative imports with a `.js` extension. The samples use `ESNext` with `Bundler`, which also works; see [NodeNext or Bundler?](../troubleshooting.md#nodenext-or-bundler) |
| `verbatimModuleSyntax` | Keeps imports as written; use `import type` for an import that is only a type |
| `include` | Compiles the entry point and the artifacts, and leaves the generated client proxies out |

## Write a command and a query

Arc discovers artifacts under one folder and derives each route from the artifact's folder and class name. Lay the notes feature out as vertical slices, one folder per behavior:

```text
my-arc-app/
├── Features/
│   └── Notes/
│       ├── NoteId.ts
│       ├── NoteText.ts
│       ├── Notes.ts
│       ├── Writing/
│       │   └── Writing.ts
│       └── Listing/
│           └── Listing.ts
├── generate.mjs
├── main.ts
├── package.json
└── tsconfig.json
```

Give the domain values their own types, as the Tasks sample does:

```typescript title="Features/Notes/NoteId.ts"
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class NoteId extends ConceptAs<Guid> { static readonly valueType = Guid; }
```

```typescript title="Features/Notes/NoteText.ts"
import { ConceptAs } from '@cratis/fundamentals';

export class NoteText extends ConceptAs<string> { static readonly valueType = String; }
```

The command and its validator form the writing slice:

```typescript title="Features/Notes/Writing/Writing.ts"
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '@cratis/arc.core';
import { NoteId } from '../NoteId.js';
import { NoteText } from '../NoteText.js';
import { Notes } from '../Notes.js';

@command()
export class WriteNote {
    @field(NoteId) id!: NoteId;
    @field(NoteText) text!: NoteText;

    handle(notes: Notes): NoteId {
        notes.add(this.id, this.text);
        return this.id;
    }
}

@validator(WriteNote)
export class WriteNoteValidator extends CommandValidator<WriteNote> {
    constructor() {
        super();
        this.ruleFor(command => command.text).notEmpty().withMessage('A note needs text');
        this.ruleFor(command => command.text).maxLength(200).withMessage('A note can have at most 200 characters');
    }
}
```

The read model and its query form the listing slice:

```typescript title="Features/Notes/Listing/Listing.ts"
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import { NoteId } from '../NoteId.js';
import { NoteText } from '../NoteText.js';
import type { Notes } from '../Notes.js';

@readModel()
export class Note {
    @field(NoteId) id: NoteId;
    @field(NoteText) text: NoteText;

    constructor(id: NoteId, text: NoteText) {
        this.id = id;
        this.text = text;
    }

    @query()
    static allNotes(notes: Notes): Note[] { return notes.all(); }
}
```

Both slices use one in-memory store. It creates each `Note` through the constructor:

```typescript title="Features/Notes/Notes.ts"
import { Note } from './Listing/Listing.js';
import { NoteId } from './NoteId.js';
import { NoteText } from './NoteText.js';

/** In-memory storage for this guide; a restart clears it. */
export class Notes {
    readonly #items = new Map<string, Note>();

    add(id: NoteId, text: NoteText): void { this.#items.set(id.toString(), new Note(id, text)); }
    all(): Note[] { return [...this.#items.values()]; }
}
```

Finally, the entry point:

```typescript title="main.ts"
import { ArcApplication } from '@cratis/arc.core';
import { metadata } from './Features/generatedMetadata.js';
import { Notes } from './Features/Notes/Notes.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Notes);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

`handle(notes: Notes)` and `allNotes(notes: Notes)` carry no `@inject(...)`. TypeScript erases parameter types when it compiles, so Arc reads them from the generated metadata module that `main.ts` imports. That module does not exist yet.

## Generate the metadata

`arc-proxygenerator` reads your artifacts with the TypeScript compiler and writes the metadata module. It also writes client proxies, for a frontend you may add later. The CLI takes absolute paths and needs an existing output folder, so run it from a small script, as the samples do:

```javascript title="generate.mjs"
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('@cratis/arc.proxygenerator')));
mkdirSync(path('./generated'), { recursive: true });
const result = spawnSync(process.execPath, [cli,
    '--project', path('./tsconfig.json'),
    '--artifacts', path('./Features'),
    '--output', path('./generated'),
    '--metadata', path('./Features/generatedMetadata.ts'),
    ...process.argv.slice(2)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
```

Run it:

```bash
npm run generate
```

It prints `Generated 6 changed file(s)`: `Features/generatedMetadata.ts` and five proxy files under `generated/`. Commit the metadata module with your source, and never edit it by hand. Arc rejects metadata that no longer matches the classes when the server starts, so regenerate after every change to a command, read model, or validator. In CI, `npm run generate -- --check-metadata` fails when the committed module is stale. [Generate artifact metadata](../proxy-generation/generated-artifact-metadata.md) covers what the module records.

## Run the development loop

Use two terminals. The first regenerates the metadata whenever an artifact changes:

```bash
npm run generate -- --watch
```

It prints `Watch ready`. The second runs the server with `tsx`, which compiles each file in memory and restarts when a file changes:

```bash
npm run dev
```

The server prints nothing when it starts. It listens on `127.0.0.1:3000` until you press Ctrl+C; set `PORT` to use another port. When you change a command's `handle()` signature, `tsx` may restart first and stop with `Stale generated artifact metadata`. The generator then rewrites the metadata, and `tsx` restarts again with it.

Node.js type stripping cannot run this project on its own: it does not transform decorators, so `node main.ts` stops with `SyntaxError: Invalid or unexpected token`. Use `tsx` while you develop and `npm run build` for a compiled run.

## Check it with curl

Write a note:

```bash
curl -X POST http://127.0.0.1:3000/api/notes/writing/write-note \
  -H 'content-type: application/json' \
  -d '{"id":"3f1c2a4e-9b7d-4c1e-8a2f-5d6e7f809a1b","text":"Buy milk"}'
```

The answer is HTTP 200 with `"isSuccess":true` and the note's ID as `response`. Now send an empty text:

```bash
curl -X POST http://127.0.0.1:3000/api/notes/writing/write-note \
  -H 'content-type: application/json' \
  -d '{"id":"4a2d3b5f-0c8e-4d2f-9b3a-6e7f8091a2c3","text":""}'
```

The answer is HTTP 400, and `validationResults` holds the rule from your validator:

```json
{"severity":3,"message":"A note needs text","members":["text"],"reason":"rule"}
```

Read the notes back:

```bash
curl http://127.0.0.1:3000/api/notes/listing/all-notes
```

The answer's `data` is `[{"id":"3f1c2a4e-9b7d-4c1e-8a2f-5d6e7f809a1b","text":"Buy milk"}]`. The store lives in memory, so a restart empties it.

## Build and start

For a run without `tsx`, compile to `dist` and start the emitted JavaScript:

```bash
npm run build
npm start
```

`npm run build` regenerates the metadata before it compiles, so the build never ships stale metadata. Add `node_modules/` and `dist/` to `.gitignore`. Whether you also commit `generated/` depends on your frontend; see [Set up proxy generation](../proxy-generation/getting-started.md).

## Choose a host

`app.run()` starts Arc's standalone Node host. To serve the same artifacts from a web framework, keep the builder lines in `main.ts` and replace `app.run()` with the framework's adapter. Pack and install the adapter as you did the core, together with the framework itself, for example `npm install ../arc-packages/arc.express.tgz express@^5`:

| Host | Package to pack | Guide |
| --- | --- | --- |
| Standalone Node host | none; it is part of `@cratis/arc.core` | [Arc.Core](../core/index.md) |
| Express 5 | `@cratis/arc.express` | [Express](../hosts/express.md) |
| Fastify 5 | `@cratis/arc.fastify` | [Fastify](../hosts/fastify.md) |
| Hono 4 | `@cratis/arc.hono` | [Hono](../hosts/hono.md) |
| Bun, Deno, Workers, or another Fetch API runtime | none; the `@cratis/arc.core/fetch` entry, which registers artifacts with `builder.add(...)` instead of discovery | [Fetch API runtimes](../hosts/fetch-runtimes.md) |

The [hosting overview](../overview.md) compares them.

## Work inside the clone instead

Inside a clone, the root `package.json` makes every folder under `Samples/` a Yarn workspace, and `workspace:^` links the local packages without packing. Create `Samples/MyArcApp` with the same files as above, but with this `package.json`:

```json title="Samples/MyArcApp/package.json"
{
  "name": "my-arc-app",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "node generate.mjs",
    "build": "yarn generate && tsc6",
    "start": "node dist/main.js",
    "dev": "tsx watch main.ts"
  },
  "dependencies": {
    "@cratis/arc.core": "workspace:^",
    "@cratis/fundamentals": "7.19.6",
    "@opentelemetry/api": "^1.9.0"
  },
  "devDependencies": {
    "@cratis/arc.proxygenerator": "workspace:^",
    "@types/node": "^22.0.0",
    "tsx": "^4.20.0",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

Then install and run from the repository root:

```bash
yarn install
yarn build
yarn workspace my-arc-app generate
yarn workspace my-arc-app dev
```

`yarn install` adds your workspace to `yarn.lock`. Keep that change, and the application, out of any pull request to this repository. `yarn build` rebuilds the packages your application links to, so run it after you change Arc itself.

## If something goes wrong

- `npm install` cannot find `@cratis/arc.core`, or reports `workspace:^`: see [Installing Arc outside the clone fails](../troubleshooting.md#installing-arc-outside-the-clone-fails).
- The server stops with `Unbound handle parameters`, `Missing parameter metadata`, or `Stale generated artifact metadata`: see [Unbound handle parameters](../troubleshooting.md#build-fails-with-unbound-handle-parameters-or-missing-parameter-metadata) and [Stale generated metadata](../troubleshooting.md#the-server-stops-with-stale-generated-artifact-metadata).
- `corepack: command not found`: see [Corepack is missing](../troubleshooting.md#corepack-is-missing).

## Next steps

- [Add event sourcing](../chronicle/add-event-sourcing.md) continues with this project: it starts a local Chronicle kernel and records a first event from a command.
- [Your first command](your-first-command.md) explains concept validators, read models, and a spec, using the Tasks sample.
- [Set up proxy generation](../proxy-generation/getting-started.md) points the generator at a React frontend and installs the client packages the proxies import.
- [Testing](../testing/index.md) runs commands and queries through Arc's pipelines in a spec, without a listener. It needs `@cratis/arc.testing`, packed like the core.
- [Configuration](../configuration/index.md) lists the settings `createBuilder()` reads from `appsettings.json` and `Cratis__...` environment variables.
- [Vertical slices](../vertical-slices.md) explains the folder layout this guide uses.
