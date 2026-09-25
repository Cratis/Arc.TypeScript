---
title: Troubleshooting
description: Fix the common Arc for TypeScript problems with installation, decorators and compilers, generated metadata, module resolution, discovery, host adapters, authentication, and generated clients.
---

Each entry names the symptom, the usual cause, and the fix, with a link to the page that has the full contract.

## Installation

### Installing Arc outside the clone fails

`npm install @cratis/arc.core` fails with `404 Not Found`, or installing a tarball fails with `Unsupported URL Type "workspace:": workspace:^`. The Arc packages are not published to npm, and a `workspace:^` dependency resolves only inside this repository's Yarn workspace. Build a clone, pack the packages you need with `yarn workspace <package> pack`, and install the tarballs. Do not use `npm pack`: it leaves the internal `workspace:^` dependencies in the packed manifest, and the tarball fails with the second error. See [Create an application](getting-started/create-an-application.md).

### Corepack is missing

`corepack enable` fails with `command not found`. Node.js 25 and later no longer include Corepack. Install it with `npm install --global corepack`, then run `corepack enable` again. The repository pins its Yarn version in `package.json`, and Corepack selects that version.

## Decorators and compilers

### TS1241: Unable to resolve signature of method decorator

In standard decorator mode, `@inject(...)` and `@query(...)` type-check the method's parameters against the tokens and descriptors you list. The error almost always means they disagree: a missing or extra token, the wrong order, or a `handle()` that forgot the `provide()` result as its **first** parameter. Make the list match the signature one to one. See [Dependency injection](dependency-injection.md#decorator-modes).

### "SyntaxError: Invalid or unexpected token" at a decorator when running .ts directly

Node.js type stripping removes types but does not transform decorators, so `node file.ts` fails at the first `@`. Compile first with `tsc` (the sample's `yarn build`) or with esbuild, which lowers standard decorators for `target: "es2022"`, and run the emitted JavaScript. During development, run the source with `tsx watch`, as [Create an application](getting-started/create-an-application.md#run-the-development-loop) does.

### Decorators do nothing, or metadata is missing, in Vitest or Vite

The test transformer must lower standard decorators with `useDefineForClassFields: true`. This repository adds an esbuild pre-transform plugin for `.ts` files in its [`vite.base.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/vite.base.ts), with `target: 'es2022'` and `experimentalDecorators: false`. Use the same approach in your own Vitest configuration.

### build() fails with "Unbound handle parameters" or "Missing parameter metadata"

This is the usual first-run failure of a new application. TypeScript erases parameter types at runtime, so without help Arc cannot tell that `handle(tasks: Tasks)` needs the `Tasks` service. `build()` stops with one of these messages:

| Message | Cause |
| --- | --- |
| `Unbound handle parameters on <Type>.handle; use builder.useGeneratedMetadata(metadata) or @inject(...); default and rest parameters require explicit binding` | A command's `handle()` has parameters and no tokens |
| `Unbound provide parameters on <Type>.provide; use builder.useGeneratedMetadata(metadata) or @inject(...); default and rest parameters require explicit binding` | The same for `provide()` |
| `Missing parameter metadata for <Type>.<method>; use explicit tokens` | A bare `@query()` or an empty `@inject()` on a method with parameters, in standard decorator mode |
| `Unbound parameters on <Type>.<method>` | The `@query(...)` descriptors do not cover every parameter of the method |

Fix it one of two ways:

- Generate artifact metadata with `arc-proxygenerator --metadata <file>` and call `builder.useGeneratedMetadata(metadata)` before `discover()` or `add()`, as the Tasks sample does. See [Generate artifact metadata](proxy-generation/generated-artifact-metadata.md).
- List the tokens yourself: `@inject(Tasks)` on `handle()`, and `@query(argument('id', TaskId), service(Tasks))` in parameter order on a query.

Default and rest parameters always need explicit tokens. In legacy `experimentalDecorators` mode with `emitDecoratorMetadata`, an empty `@inject()` or a bare `@query()` infers class-valued parameters from `design:paramtypes`; a parameter it cannot infer fails with `Unresolvable parameter on <Type>.<method>; use explicit tokens`. See [Dependency injection](dependency-injection.md#decorator-modes).

### The server stops with stale generated artifact metadata

`builder.useGeneratedMetadata(metadata)` throws `Stale generated artifact metadata for <Type>; regenerate artifact metadata`, or `arc-proxygenerator --check-metadata` fails with `Stale or missing generated artifact metadata: <file>; regenerate artifact metadata`. An artifact changed after the metadata module was generated, for example a field or the number of `handle()` parameters. A query method added since the last run fails as `Missing parameter metadata for <Type>.<method>` instead, described above.

Run the generator again with the same options. While you develop, keep it running with `--watch` beside your `tsx` process; `tsx` may restart once with the old module before the generator finishes. Reordering parameters without changing their count goes undetected, so regenerate after every artifact edit and gate CI with `--check-metadata`. See [Generate artifact metadata](proxy-generation/generated-artifact-metadata.md).

## Module resolution

### NodeNext or Bundler?

Server code that imports `@cratis/arc.core` and `@cratis/fundamentals` 7.19.6 type-checks with `module` and `moduleResolution` set to `NodeNext`, or with `ESNext` and `Bundler` as the Tasks sample does. With NodeNext and native ESM, keep `.js` extensions on relative imports.

Generated frontend proxies are different: the published `@cratis/arc` client declarations use extensionless imports, so compile proxies in `Bundler` mode. `NodeNext` consumer compilation of generated proxies is not supported. See [Proxy generation](proxy-generation/index.md#compatibility).

## Discovery

### discover() refuses the folder

`discover()` refuses a folder that contains the entry point or an imported bootstrap that is itself calling discovery, because importing it would re-enter a suspended top-level `await`. Put artifacts in a dedicated folder such as `Features/`. It also rejects a folder that mixes emitted `.js` and loader-backed `.ts` files.

### An artifact is not found

`discover()` only registers **exported** classes, and skips `dist`, `node_modules`, `given`, `for_*`, `index.*`, declaration files, and symbolic links. A validator that is never imported is never registered: add it with `builder.add(...)` or keep it under the discovery root.

### Routes changed after a refactor, or are wrong in a bundled build

Routes derive from folders and class names. A folder move changes the route, and a bundler that renames classes changes it too. Pin routes with `@command({ namespace })`, `@readModel({ namespace })`, or `@path(...)`, and keep class names (`keepNames` in esbuild). See [Endpoint mapping](core/endpoint-mapping.md).

### "Not an Arc artifact"

`builder.add(...)` received a class without an Arc decorator. Check that the class has `@command()`, `@readModel()`, `@validator(...)`, a lifetime decorator, or one of the extension-point decorators.

## Hosting

### Every command answers 400 malformedRequest behind Express

A body parser such as `express.json()` ran before Arc and consumed the body. Call `app.use(cratisArc(arc))` before adding body parsers. See [Express](hosts/express.md).

### Fastify answers 413 for a large body

Fastify's `bodyLimit`, 1 MiB by default, applies before Arc's `hosting.maxBodyBytes`. Raise both. See [Fastify](hosts/fastify.md).

### A browser WebSocket never opens from a dev server

The page's origin differs from the server's, so the `Origin` check refuses the upgrade. Add the dev server origin, and your application origin, to `query.allowedOrigins`. See [WebSockets](hosts/websockets.md#origin-checks).

### An observable query answers 202

The source has no current value yet. Use RxJS `new BehaviorSubject(value)` for a current value, or ask with `waitForFirstResult=true`. An emission guard that suppresses the snapshot also answers 202. See [Using observable queries with curl](queries/using-observable-queries-with-curl.md).

## Security

### A protected operation answers 403 where you expected 401

No authentication handler is configured, so nobody is authenticated and the declaration fails at the authorization step. Configure `authentication`, or a [native principal](hosts/native-principal.md).

### The server refuses to start with native principal and handlers

`nativePrincipal: true` and `authentication` handlers are mutually exclusive. Choose one boundary. See [Authentication](core/authentication.md#choose-an-authentication-boundary).

## Generated clients

### The generated client calls a route that answers 404

The generator's route options do not match the server's `generatedApis` settings or discovery root namespace. Align `--api-prefix`, `--segments-to-skip`, `--root-namespace`, and the name-in-route switches. See [Proxy generator configuration](proxy-generation/configuration.md#route-alignment).

### "Ambiguous model name"

The proxy generator fails with `Ambiguous model name: <Namespace>.<Name>` when two different model declarations have the same namespace and class name. The generator derives a model's namespace from its folder below the artifacts root, so this happens when two files in one folder declare the same model name. Models with the same class name in different folders are supported. Rename one of the two, or move it to another folder.

## Chronicle

### Decorated events or read models fail at load

The Chronicle SDK needs `reflect-metadata`. Import it first in your entry point. See [Add event sourcing](chronicle/add-event-sourcing.md).

## Related

- [Capability reference](reference/capabilities.md) for what is and is not implemented
- [Code analysis](code-analysis/index.md) to catch many of these in the editor
