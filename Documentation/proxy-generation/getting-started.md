---
title: Set up proxy generation
description: Point arc-proxygenerator at an existing Arc backend, write the proxies into a dedicated frontend folder, install the client packages, and keep generation repeatable.
---

Start with an Arc backend that already has [commands](../commands/index.md) or [queries](../queries/index.md), and a React frontend beside it. By the end of this guide the frontend has a `src/generated` folder with typed proxies, and the frontend compiler checks every call against the backend's declarations.

The steps follow the [Library sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/README.md): a backend in `Samples/Library/Features` and a Vite frontend in `Samples/Library/Web`.

## Build the generator

`@cratis/arc.proxygenerator` is not published to npm. Build it from a clone of this repository:

```sh
yarn install --immutable
yarn build
```

The CLI is then `Source/Tools/ProxyGenerator/dist/cli.js`. Run it with `node`. For a backend outside the clone, install the packed generator as a development dependency instead; [Create an application](../getting-started/create-an-application.md#generate-the-metadata) shows the install and a matching script.

## Choose a dedicated output folder

Give the generator a folder it owns, such as `Web/src/generated`, instead of the frontend's `src` root. On every run it replaces files it wrote, removes files for artifacts that no longer exist, and leaves hand-written files alone. A folder that only holds generated code makes that easy to review. [File index tracking](file-index-tracking.md) explains how it tells the two apart.

The output folder must exist before the first run.

## Run the generator from a script

A small script keeps the options in one place. This is the Library sample's [`generate-proxies.mjs`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/generate-proxies.mjs):

```javascript title="generate-proxies.mjs"
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(root, 'Web/src/generated'), { recursive: true });
execFileSync(process.execPath, [join(root, '../../Source/Tools/ProxyGenerator/dist/cli.js'),
    '--project', join(root, 'tsconfig.json'), '--artifacts', join(root, 'Features'),
    '--output', join(root, 'Web/src/generated'), '--metadata', join(root, 'Features/generatedMetadata.ts'),
    '--use-proxy-file-suffix'], { stdio: 'inherit' });
```

The CLI rejects relative paths, so the script builds every path from its own location.

| Option | Why it is here |
| --- | --- |
| `--project` | The backend's `tsconfig.json`, so the compiler API resolves your imports and decorators |
| `--artifacts` | The same folder the backend passes to `builder.discover(...)` |
| `--output` | The generated-only frontend folder |
| `--metadata` | Also writes the server metadata module that `main.ts` registers with `useGeneratedMetadata`. Use `--use-generated-metadata` instead when you only want client output |
| `--use-proxy-file-suffix` | Names files `*.proxy.ts`, so generated files stand out in imports and reviews |

Run it with `yarn workspace @cratis/arc.sample.library generate-proxies`. Each run reports how many files it changed. A run with nothing to change prints `Generated 0 changed file(s)` and leaves every file untouched, timestamps included.

If your server changes route options, such as `generatedApis.routePrefix` or a `rootNamespace` for discovery, pass the matching [route alignment](configuration.md#route-alignment) options too. Otherwise the proxies call URLs the server does not serve.

## Look at the result

The output mirrors the backend's namespaces, one file per artifact and a barrel per folder:

```text
Web/src/generated/Authors/Listing/AllAuthors.proxy.ts
Web/src/generated/Authors/Listing/Author.proxy.ts
Web/src/generated/Authors/Listing/AuthorsPage.proxy.ts
Web/src/generated/Authors/Listing/index.ts
Web/src/generated/Authors/Registration/RegisterAuthor.proxy.ts
Web/src/generated/Authors/Registration/index.ts
Web/src/generated/Books/Listing/Book.proxy.ts
Web/src/generated/Books/Listing/BooksForAuthor.proxy.ts
Web/src/generated/Books/Listing/index.ts
Web/src/generated/Books/Registration/AddBook.proxy.ts
Web/src/generated/Books/Registration/index.ts
```

`AllAuthors` and `AuthorsPage` are static query methods on the `Author` read model. Each query method gets its own file, named after the method, in the read model's folder.

## Install the frontend packages

The generated files import the published client packages directly. In the frontend project, install:

```sh
npm install @cratis/arc@22.19.1 @cratis/arc.react@22.19.1 @cratis/fundamentals react react-dom reflect-metadata
```

Generated commands and queries import both `@cratis/arc` and the React hooks from `@cratis/arc.react`, even when you only use the classes. Models use `@field` from `@cratis/fundamentals`. `@cratis/arc.react` accepts React 18 or 19.

Import `reflect-metadata` once, before anything else, in the frontend's entry point, as the Library sample's `main.tsx` does. Compile the frontend in `Bundler` module resolution with `experimentalDecorators: true`, as both samples do.

## Check it compiles

Compile the frontend with its own type check. For the Library sample:

```sh
yarn workspace @cratis/arc.sample.library.web build
```

This second checkpoint catches a missing package, a decorator setting, or an import path that does not match the generated folders. A type error that points into a generated file almost always means a package version or compiler setting differs from the ones above, since generated files are never edited by hand.

## Keep generation repeatable

- **Commit or regenerate, and pick one.** The Library sample commits `Web/src/generated`, so the frontend builds without running the backend's tooling. Unchanged runs keep files byte for byte, so committed output only changes when the source does.
- **Regenerate with the backend.** Run the script whenever a command, query, model, or validator changes. During development, add `--watch` to the same options in a separate terminal.
- **Gate stale server metadata.** When you use `--metadata`, run the generator with `--check-metadata` in CI; it fails when the committed module no longer matches the source.

Next, [use the proxies in React](frontend-usage.md).
