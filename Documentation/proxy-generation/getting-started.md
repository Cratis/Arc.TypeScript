---
title: Set up proxy generation
description: Generate browser proxies beside backend slices, install the client packages, and keep generation repeatable.
---

Start with an Arc backend that already has [commands](../commands/index.md) or [queries](../queries/index.md), and a React frontend beside it. By the end of this guide each slice holds its backend module, typed proxies, and React component; the frontend compiler checks every call against the backend's declarations.

The steps follow the [Library sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/README.md): a backend in `Samples/Library/Features` and a Vite frontend in `Samples/Library/Web`.

## Build the generator

`@cratis/arc.proxygenerator` is not published to npm. Build it from a clone of this repository:

```sh
yarn install --immutable
yarn build
```

The CLI is then `Source/Tools/ProxyGenerator/dist/cli.js`. Run it with `node`. For a backend outside the clone, install the packed generator as a development dependency instead; [Create an application](../getting-started/create-an-application.md#generate-the-metadata) shows the install and a matching script.

## Keep the proxy beside the slice

Use the same existing `Features` folder for `--artifacts` and `--output`. The generator requires `--use-proxy-file-suffix` in this mode so proxies cannot take the names of backend modules. It writes no `index.ts` barrels in the artifacts tree. On every run it replaces files it owns, removes stale owned files, and leaves handwritten files alone; collisions with handwritten files fail before writing. [File index tracking](file-index-tracking.md) explains how it recognizes owned files. The output folder must exist before the first run.

## Run the generator from a script

A small script keeps the options in one place. This is the Library sample's [`generate-proxies.mjs`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/generate-proxies.mjs):

```javascript title="generate-proxies.mjs"
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(root, '../../Source/Tools/ProxyGenerator/dist/cli.js'),
    '--project', join(root, 'tsconfig.json'), '--artifacts', join(root, 'Features'),
    '--output', join(root, 'Features'), '--metadata', join(root, 'Features/generatedMetadata.ts'),
    '--use-proxy-file-suffix'], { stdio: 'inherit' });
```

The CLI rejects relative paths, so the script builds every path from its own location.

| Option | Why it is here |
| --- | --- |
| `--project` | The backend's `tsconfig.json`, so the compiler API resolves your imports and decorators |
| `--artifacts` | The same folder the backend passes to `builder.discover(...)` |
| `--output` | The existing `Features` folder: generated proxies sit beside the backend modules |
| `--metadata` | Also writes the server metadata module that `main.ts` registers with `useGeneratedMetadata`. Use `--use-generated-metadata` instead when you only want client output |
| `--use-proxy-file-suffix` | Required when the output overlaps the artifacts: prevents generated names from colliding with backend modules |

Run it with `yarn workspace @cratis/arc.sample.library generate-proxies`. Each run reports how many files it changed. A run with nothing to change prints `Generated 0 changed file(s)` and leaves every file untouched, timestamps included.

If your server changes route options, such as `generatedApis.routePrefix` or a `rootNamespace` for discovery, pass the matching [route alignment](configuration.md#route-alignment) options too. Otherwise the proxies call URLs the server does not serve.

## Look at the result

The output mirrors the backend's namespaces, one proxy per operation and model, with no generated barrels:

```text
Features/Authors/Registration/
├── Registration.ts
├── RegisterAuthor.proxy.ts
└── RegisterAuthorForm.tsx
Features/Authors/Listing/
├── Listing.ts
├── AllAuthors.proxy.ts
├── Author.proxy.ts
├── AuthorsPage.proxy.ts
└── AuthorCatalog.tsx
```

Do not give a `.tsx` component the same basename as a `.ts` backend file. Name it for what it renders, as `RegisterAuthorForm.tsx` does.

`AllAuthors` and `AuthorsPage` are static query methods on the `Author` read model. Each query method gets its own file, named after the method, in the read model's folder.

## Install the frontend packages

The generated files and React components live in `Features/`, not `Web/`. Install their client dependencies in the package that owns `Features/` (or a common ancestor/workspace root that resolves imports from `Features/`):

```sh
cd path/to/package-containing-Features
npm install @cratis/arc@22.19.1 @cratis/arc.react@22.19.1 @cratis/fundamentals react react-dom reflect-metadata
# If your slices use Cratis Components:
npm install @cratis/components@4.6.0
```

Also declare the dependencies imported by the web app in its own package. Installing packages only in a sibling `Web/node_modules` does **not** make them resolvable from `Features/`; including the slices in `Web/tsconfig.json` does not change that. The Library sample declares these dependencies in [`Samples/Library/package.json`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/package.json) for its slices and in [`Web/package.json`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Web/package.json) for its app shell. Generated commands and queries import both `@cratis/arc` and the React hooks from `@cratis/arc.react`, even when you only use the classes. Models use `@field` from `@cratis/fundamentals`. `@cratis/arc.react` accepts React 18 or 19.

Import `reflect-metadata` once, before anything else, in the frontend's entry point, as the Library sample's `main.tsx` does. Compile the frontend in `Bundler` module resolution with `experimentalDecorators: true`. The backend tsconfig excludes `**/*.proxy.ts` and `**/*.tsx`; the web tsconfig includes them under `../Features`, without including the backend `.ts` modules. Allow Vite to read the slice folder outside `Web/` and deduplicate packages imported from both locations. Vite 8's Oxc transform reads the nearest tsconfig **per file**: a proxy in `Features/` does not inherit `Web/tsconfig.json`'s `experimentalDecorators`. Configure Vite explicitly for the proxies' legacy decorator mode, as in the Library sample's [`vite.config.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Web/vite.config.ts):

```typescript title="Web/vite.config.ts (excerpt)"
export default defineConfig({
    oxc: { decorator: { legacy: true } },
    resolve: { dedupe: ['react', 'react-dom', '@cratis/arc', '@cratis/arc.react', '@cratis/fundamentals', '@cratis/components'] },
    server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), slices] } }
});
```

Here `slices` is the absolute path to `Features/` (see the linked config); omit `@cratis/components` from the dedupe list if your slices do not use it.

Other bundlers reading slices outside the web project likewise need a legacy decorator transform; checking only the web tsconfig does not ensure the browser can parse the bundle.

## Check it compiles

Compile the frontend with its own type check. For the Library sample:

```sh
yarn workspace @cratis/arc.sample.library.web build
```

The Library build also checks that the production JavaScript parses and the Vite dev transform lowers decorators in a co-located proxy. This second checkpoint catches a missing package, a decorator setting, or an import path that does not match the generated folders. A type error that points into a generated file almost always means a package version or compiler setting differs from the ones above, since generated files are never edited by hand.

## Keep generation repeatable

- **Commit or regenerate, and pick one.** Library and Tasks commit their co-located proxies, so a frontend can build without running backend tooling. Unchanged runs keep files byte for byte, so committed output only changes when the source does.
- **Regenerate with the backend.** Run the script whenever a command, query, model, or validator changes. During development, add `--watch` to the same options in a separate terminal.
- **Gate stale server metadata.** When you use `--metadata`, run the generator with `--check-metadata` in CI; it fails when the committed module no longer matches the source.

## Separate output folders

For a frontend in another repository, or if its build cannot read the backend's slice tree, set `--output` to an existing dedicated folder such as `Web/src/generated`. This mode keeps its per-directory `index.ts` barrels by default and does not require `--use-proxy-file-suffix` (you can still opt in). Include that folder in the frontend tsconfig, and exclude it from the backend build. The generator still deletes only files it owns; do not point it at the frontend's handwritten `src` root without reviewing existing files.

Next, [use the proxies in React](frontend-usage.md).
