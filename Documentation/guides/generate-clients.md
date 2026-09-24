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

The output contains `Tasks/Listing/TaskItem.proxy.ts`, `Tasks/Registration/RegisterTask.proxy.ts` and `Tasks/Listing/allTasks.proxy.ts`, plus directory-local `index.ts` barrels. The proxies compile against `@cratis/arc@22.19.1`, `@cratis/arc.react@22.19.1` and `@cratis/fundamentals@7.19.3` in strict Bundler mode with `skipLibCheck: false`. Commands, queries with arguments, paging, sorting, observable snapshots and WebSocket hub updates are exercised against live model-bound Express, Fastify and Hono servers by `yarn test:client-generation`.

The CLI accepts `--segments-to-skip <nonnegative integer>`, `--api-prefix <prefix>`, `--skip-command-name-in-route`, and `--skip-query-name-in-route`; they use the same route functions as the server. `--use-proxy-file-suffix` is optional. Output and local `.js` imports are stable between runs; changed generated files are replaced, stale owned files removed, and handwritten files never overwritten or deleted. The output root must already exist and be a real directory.

The source analyzer currently handles standard and legacy decorators recognized through their imported symbols, decorated fields, `ConceptAs<T>`, primitives, Fundamentals dates and GUIDs, arrays, string/number enums, string-literal unions, `Promise<T>`, `ObservableSource<T>`, `AsyncIterable<T>` and model types. Query arguments require explicit `@query(argument(...))` bindings for runtime use. Unsupported result types fail with a file/line diagnostic rather than falling back to `any`. It does **not** yet generate a server metadata module, infer erased service tokens, extract recorded server validator rules automatically, or cover identity-only types, inherited/derived models and the full .NET generator surface. The programmatic `renderSource` accepts an optional `recordedRules` map for portable validation rules; server-only rules produce diagnostics. Do not treat the current output as complete .NET proxy parity.

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
