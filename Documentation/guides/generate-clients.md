---
title: Generate command and query clients
description: Analyze decorated TypeScript artifacts to generate Arc frontend proxies, or use a bounded JSON manifest for low-level definitions.
---

Generate frontend clients from the decorated commands and read models in your TypeScript project. The analyzer reads source through the TypeScript 6 compiler API; it does not import or execute application startup. This is a source-checkout preview, not an npm release.

## Generate from decorated artifacts

Build the workspace, create an output directory and run the CLI with the Tasks sample's existing `tsconfig.json` and dedicated `Features/` artifact folder:

```sh
yarn install --immutable
yarn build
mkdir -p my-app/frontend/src/generated
node Source/Tools/ProxyGenerator/dist/cli.js \
  --project "$PWD/Samples/Tasks/tsconfig.json" \
  --artifacts "$PWD/Samples/Tasks/Features" \
  --output "$PWD/my-app/frontend/src/generated" \
  --use-proxy-file-suffix
```

The output contains `Tasks/Listing/TaskItem.proxy.ts`, `Tasks/Registration/RegisterTask.proxy.ts` and `Tasks/Listing/AllTasks.proxy.ts`, plus directory-local `index.ts` barrels. The proxies compile against `@cratis/arc@22.19.1`, `@cratis/arc.react@22.19.1` and `@cratis/fundamentals@7.19.3` in strict Bundler mode with `skipLibCheck: false`. Commands, queries with arguments, paging, sorting, observable snapshots and WebSocket hub updates are exercised against live model-bound Express, Fastify and Hono servers by `yarn test:client-generation`.

The CLI accepts `--root-namespace <namespace>`, `--segments-to-skip <nonnegative integer>`, `--api-prefix <prefix>` (also `--api-prefix=<prefix>`), `--skip-command-name-in-route`, and `--skip-query-name-in-route`; match the server's discovery namespace and route settings. `--help` prints usage. `--use-proxy-file-suffix` is optional. Local imports are **extensionless by default**, matching .NET output and the published `@cratis/arc` client in Vite/Bundler frontends. Use `--js-import-specifiers` for native Node ESM after compilation. `--emit-interfaces` emits undecorated interfaces in place of model classes; model constructors in proxies become `Object`, so choose this only when you do not need decorated model hydration. `--skip-index-generation` omits generated barrels, and `--skip-output-deletion` retains stale owned files. Options that take values accept both space and `=` forms, but reject missing or empty values. Generated files and generated barrels carry the source/time/hash ownership header. Repeated runs keep unchanged bytes and timestamps; changed owned files are replaced and stale owned files removed unless deletion is skipped. A hand-written barrel is never replaced with generated exports; when stale owned files are deleted, only its exports of those files are removed. Directory and package re-exports remain intact. Other handwritten files are never overwritten or deleted. The output root must exist; the generator resolves symlinked ancestors such as `/tmp` to their real path and refuses symlinks *inside* the output. The Tasks sample's `generate-proxies` script writes to ignored `dist/proxies` and compiles it in CI after `yarn build`.

The source analyzer recognizes decorators and Fundamentals types by resolved symbol and declaring package (not path spelling). It shares Arc's discovery walk: only exported classes under the artifacts folder are considered; `index.ts`, `given/`, `dist/`, `node_modules/`, `for_*/`, and symlinks are skipped. It handles decorated fields, `ConceptAs<T>`, primitives, Fundamentals dates and GUIDs, arrays, string/number enums, string-literal unions, `Promise<T>`, `QueryPage<T>`, `ObservableSource<T>`, `AsyncIterable<T>` and model types. `@optional()`, `@nullable()`, `@defaultValue()` and `@enumeration()` determine field behavior; an undecorated `?` cannot make a server-required field optional and fails with a diagnostic. A required nullable field has `T | null` in generated TypeScript; explicit null command serialization with the published client has not been verified end to end. Query arguments require explicit `@query(argument(...))` bindings for runtime use. Unsupported result types fail with a file/line diagnostic rather than falling back to `any`. It reads literal, unconditional `ruleFor` chains in `@validator(Target)` constructors and emits client-safe rules for commands (including direct concept fields) and explicit query `argumentsModel` targets. Conditions, predicates and rules that need runtime evaluation stay on the server and produce source diagnostics; the server still checks every request. Derived classes with Fundamentals `@derivedType('id')` and their declared base classes are emitted when found under the artifacts root. Two reachable models with the same class name in different namespaces currently fail with `Ambiguous model name`; namespace-qualified model keys are not yet supported. The generator does **not** yet generate server metadata, infer erased service tokens, discover identity-only types from `identityDetails`, or reproduce every .NET output template. Compared with .NET's generator, it does not emit query HTTP method choices or command warning-severity settings (`treatWarningsAsErrors` is always `false`), and it has no watch mode or metadata module. Its nullable command types and interface-only model mode have only compile coverage, not live-client equivalence. The .NET differential command capture uses a scalar generic for an enumerable result; this generator emits the array generic that matches the runtime constructor. Capture-derived semantic checks pin command/query routes, roles, parameter descriptors and hooks; they do not compare byte-for-byte templates or run the Kotlin generator. Standard-mode `@inject()` and bare `@query()` still need explicit tokens/descriptors. The programmatic `renderSource` also accepts a `recordedRules` override. Do not treat this bounded output as complete .NET proxy parity.

## Low-level path: explicit JSON manifest

For `defineCommand` and `defineQuery` definitions, export a **version 1 JSON manifest** from an explicitly registered `ArcServer`. This older CLI form reads JSON and does not import your application or discover definitions.

### Define explicit output shapes

Create `export-clients.mjs` in a project that depends on the Arc Server workspace and `zod`:

```js
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery, exportClientManifest } from '@cratis/arc.core';

const widget = {
    kind: 'dto', name: 'Widget', fields: [
        { name: 'id', type: { kind: 'string' } },
        { name: 'name', type: { kind: 'string' } }
    ]
};
const items = [];
const server = new ArcServer({
    commands: [defineCommand({
        name: 'CreateWidget', namespace: 'Sales',
        schema: z.object({ name: z.string(), note: z.string().optional() }),
        clientOutput: { output: widget },
        handle: ({ name }) => {
            const item = { id: String(items.length + 1), name };
            items.push(item);
            return item;
        }
    })],
    queries: [defineQuery({
        name: 'GetWidgets', namespace: 'Sales', path: '/v1/widgets/search',
        schema: z.object({ term: z.string() }),
        clientOutput: { output: { kind: 'array', element: widget } },
        perform: ({ term }) => items.filter(item => item.name.includes(term))
    })]
});

await writeFile('client-manifest.json', JSON.stringify(exportClientManifest(server), null, 2));
await server.dispose();
```

From this repository root, build the packages and prepare an output directory in your application before running the exporter and CLI:

```sh
yarn install --immutable
yarn build
mkdir -p my-app/frontend/src/generated
node export-clients.mjs
node Source/Tools/ProxyGenerator/dist/cli.js "$PWD/client-manifest.json" "$PWD/my-app/frontend/src/generated"
```

The exported routes come from the server's resolved operation graph, including namespace skipping and custom paths. The manifest is a portable product contract, not an authentication credential or verification receipt. Review the static definitions you load to export it: the CLI itself reads JSON only and **never imports an application startup module**. Export does not call handlers, validators, `provide`, service factories, or authorization callbacks. Input Zod defaults and refinements are rejected before legacy JSON Schema conversion can evaluate a default factory.

### Use the manifest proxies

Compile the emitted `.proxy.ts` files in a **strict ESNext/Bundler frontend** against exactly `@cratis/arc@22.19.1`, `@cratis/fundamentals@7.19.3`, and `rxjs@7.8.2`. The generated `Sales_CreateWidget` and `Sales_GetWidgets` classes use the published runtime, not an alternate client. Configure a **real listening server origin** (never the synthetic adapter origin) on each instance. For example:

```js
import { Sales_CreateWidget } from './generated/Sales_CreateWidget.proxy.js';
import { Sales_GetWidgets } from './generated/Sales_GetWidgets.proxy.js';

const origin = 'http://127.0.0.1:3000';
const command = new Sales_CreateWidget();
command.setOrigin(origin);
command.name = 'Ada';
const preflight = await command.validate();
if (preflight.isSuccess) {
    const saved = await command.execute();
    console.log(saved.response?.name);
}
const query = new Sales_GetWidgets();
query.setOrigin(origin);
const found = await query.perform({ term: 'Ada' });
console.log(found.data.map(widget => widget.name));
```

Place the emitted sources in your frontend's `generated/` source directory and compile them with its Bundler toolchain before running this example. Your host must be listening and use these definitions for the requests to succeed. `validate()` never invokes the handler. Roles copied into proxies are informational; the server still enforces authorization. Command and query callback results are validated against declared output before a successful result is sent, and mismatches fail with the host's standard exception privacy rules.

### Bounded manifest contract

Input: closed Zod objects with plain strings, booleans, string enums, arrays of these, optional fields, and **safe-integer** `z.number().safe()` fields. Output: explicit `void` for commands, string/boolean/safe-number/string-enum command results, plain-object flat DTOs with primitive/enum/primitive-array fields, and homogeneous arrays of supported output types. Query outputs must be DTOs or arrays. DTOs are zero-argument classes with registered `@field` members. Arrays and primitive DTO members need no custom codec. Names and routes must be safe fixed identifiers/paths; no placeholders.

Generation rejects missing metadata, unsupported Zod constraints/defaults/refinements/transforms, nullable command fields, nested DTOs, open schemas, polymorphic/recursive types, duplicate or case-colliding IDs/files, and scalar query outputs. The published client loses scalar `false`, `0`, and `''` query data and cannot serialize explicit null command fields. Do not claim either shape is supported. Defaults on Zod fields are **not** exported: factory defaults can execute user code during schema conversion, and the client has no equivalent server-default contract. Optional omission is supported, not explicit null. The low-level manifest path does not generate React hooks, shared validation rules, or automatic decorator/type reflection; use the analyzer path above for decorated sources.

Query input names `page`, `pageSize`, `sortBy`, and `sortDirection` (case-insensitive) are reserved for GET paging/sorting; they are rejected even when QUERY is enabled. Empty manifests and sanitized manifests over 1 MiB are rejected; the CLI also caps input JSON at 4 MiB. Optional DTO array fields omitted on the wire can be initialized to `[]` by the published Fundamentals reflection client, so do not rely on distinguishing omission from an empty array. Required empty query arrays can be omitted by the published GET binder; use QUERY or avoid relying on that distinction. Primitive, enum, boolean, array, explicit void, and scalar-falsy command values, as well as DTO command/query, authorization, paging, sorting, and redaction cases, run against Express, Fastify, and Hono. This is bounded generated-client coverage, not full proxy parity.

The CLI requires absolute manifest and existing real output-directory paths. It validates every descriptor before writing, refuses symlink escapes and handwritten files, compares unchanged bytes, and uses temporary sibling files with atomic no-clobber links for new files and rename for owned replacements. New files receive the normal creation mode (`0o666 & ~process.umask()`); owned replacements retain their prior mode. Root identity is checked before each publish, but this is not adversarial race-free directory locking: a parent-directory swap between check and publish is outside this guarantee. On partial failure the error lists paths already committed; no rollback overwrites concurrent edits. It never deletes stale generated files; remove obsolete proxies yourself after reviewing imports. A failed or partially committed write returns a nonzero exit status, never success.

The tested frontend compiler mode is strict `ESNext`/`Bundler` with `skipLibCheck: false` and `verbatimModuleSyntax: true`. Native Node ESM loading of its emitted JavaScript also passes. **NodeNext consumer compilation is unsupported** with this published Arc/Fundamentals pair: its shipped ESM declaration barrels use extensionless relative imports. No declaration patch, shim, `any`, or `skipLibCheck` workaround is applied here. Run `yarn test:client-generation` to reproduce the generated-client compile and three live host checks.
