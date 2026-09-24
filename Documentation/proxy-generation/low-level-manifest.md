---
title: Low-level manifest
description: Generate proxies for defineCommand and defineQuery definitions from an explicit JSON client manifest, and know its bounded contract.
---

Low-level `defineCommand` and `defineQuery` definitions have Zod schemas, not decorated classes, so the source analyzer cannot see their output types. For them, you declare the output explicitly with `clientOutput`, export a **version 1 JSON manifest** from the registered `ArcServer`, and feed it to the older positional CLI form. That CLI reads JSON only; it never imports your application.

## Declare explicit output shapes

Create `export-clients.mjs` in a project that depends on the workspace packages and `zod`:

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

Then, from the repository root:

```sh
yarn install --immutable
yarn build
mkdir -p my-app/frontend/src/generated
node export-clients.mjs
node Source/Tools/ProxyGenerator/dist/cli.js "$PWD/client-manifest.json" "$PWD/my-app/frontend/src/generated"
```

The exported routes come from the server's resolved operation graph, including namespace skipping and custom paths. Export does not call handlers, validators, `provide`, service factories, or authorization callbacks. Input Zod defaults and refinements are rejected before JSON Schema conversion could evaluate a default factory. A model-bound `@command()` or `@readModel()` has no `clientOutput`, so the manifest path rejects an application that registers one; use the [source analyzer](index.md) for those.

## Use the generated proxies

Compile the emitted `.proxy.ts` files in a strict ESNext/Bundler frontend against `@cratis/arc` 22.19.1, `@cratis/fundamentals` 7.19.6, and `rxjs` 7.8.2, the versions the client contract tests pin. Set a **real listening server origin** on each instance:

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

`validate()` never invokes the handler. Roles copied into proxies are informational; the server still enforces authorization. Command and query results are validated against the declared output before a successful result is sent; a mismatch fails under the host's usual exception privacy rules. Observable definitions with `clientOutput` generate `ObservableQueryFor` proxies with the exact query name.

## The bounded contract

| Supported | Rejected |
| --- | --- |
| Closed Zod object inputs with strings, booleans, string enums, arrays of these, optional fields, and safe-integer `z.number().safe()` fields | Missing metadata, unsupported Zod constraints, defaults, refinements, and transforms |
| Command outputs: explicit `void`, string, boolean, safe number, string enum, flat DTOs, homogeneous arrays | Nullable command fields, nested DTOs, open schemas, polymorphic or recursive types |
| Query outputs: DTOs or arrays | Scalar query outputs |
| Safe fixed names and routes | Placeholders, duplicate or case-colliding IDs and files |

- Query input names `page`, `pageSize`, `sortBy`, and `sortDirection` (case-insensitive) are reserved and rejected.
- Empty manifests and sanitized manifests over 1 MiB are rejected; the CLI caps input JSON at 4 MiB.
- The published client loses scalar `false`, `0`, and `''` query data and cannot serialize explicit null command fields. Optional omission is supported; explicit null is not.
- Optional DTO array fields omitted on the wire can be initialized to `[]` by the published Fundamentals client, and required empty query arrays can be omitted by the GET binder.
- This path generates no React hooks, shared validation rules, or type reflection.

## How the CLI writes files

The CLI needs absolute paths for the manifest and an existing, real output directory. It validates every descriptor before writing, refuses symbolic-link escapes and hand-written files, keeps unchanged bytes, and publishes through temporary sibling files with atomic no-clobber links for new files and renames for owned replacements. New files receive the normal creation mode; replacements keep their mode. It is not adversarial race-free directory locking. On a partial failure, the error lists the paths already committed, nothing is rolled back, and the exit status is nonzero. It never deletes stale files; remove obsolete proxies yourself.

## Related

- [Low-level definitions](../commands/low-level-definitions.md)
- [Proxy generation](index.md)
