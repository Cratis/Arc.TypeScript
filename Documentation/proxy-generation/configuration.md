---
title: Proxy generator configuration
description: Every arc-proxygenerator option for source analysis, route alignment, output layout, and import style, with defaults.
---

`arc-proxygenerator` takes its settings on the command line. Options that take a value accept both `--option value` and `--option=value`, and reject a missing or empty value. `--help` prints the usage line.

## Required

| Option | Meaning |
| --- | --- |
| `--project <tsconfig>` | The `tsconfig.json` of the project that declares your artifacts |
| `--artifacts <folder>` | The discovery root: only exported classes below it are considered |
| `--output <folder>` | An existing output directory; use the artifacts root to co-locate proxies by default |

## Route alignment

Match these to the server's [endpoint mapping](../core/endpoint-mapping.md), or generated clients call the wrong URL.

| Option | Default | Server equivalent |
| --- | --- | --- |
| `--root-namespace <namespace>` | None | `discover(folder, { rootNamespace })`; also prefixes generated model folders |
| `--segments-to-skip <n>` | `0` | `generatedApis.segmentsToSkipForRoute` |
| `--api-prefix <prefix>` | `api` | `generatedApis.routePrefix` |
| `--skip-command-name-in-route` | Off | `generatedApis.includeCommandNameInRoute: false` |
| `--skip-query-name-in-route` | Off | `generatedApis.includeQueryNameInRoute: false` |

**Changed for upgrades:** `--root-namespace App` now writes models under `App/...` rather than only changing their routes. For example, `Orders/Order.ts` becomes `App/Orders/Order.ts`; generation removes the old file unless `--skip-output-deletion` is set. Update direct model imports before regenerating.

## Output

| Option | Default | Effect |
| --- | --- | --- |
| `--use-proxy-file-suffix` | Off for a dedicated output folder; required for co-located output | Name files `*.proxy.ts` instead of `*.ts` |
| `--js-import-specifiers` | Off | Use `.js` extensions in local imports, for native Node ESM; extensionless imports suit Vite and other bundlers |
| `--emit-interfaces` | Off | Emit undecorated interfaces instead of model classes; model constructors in proxies become `Object`, so choose this only when you do not need decorated model hydration |
| `--skip-index-generation` | Off for a dedicated output folder; automatic for co-located output | Do not write `index.ts` barrels |
| `--skip-output-deletion` | Off | Keep stale generated files instead of removing them |
| `--metadata <file>` | Off | Generate server artifact metadata at the given absolute path and infer undecorated bindings |
| `--use-generated-metadata` | Off | Infer the same bindings for client-only generation without publishing a metadata module |
| `--check-metadata` | Off | Read-only check that a module passed with `--metadata` matches current source |
| `--type-mapping <Type>=<package>[#<export>]` | None | Import a type from another package instead of generating it; repeat for several types. See [Map types to another package](#map-types-to-another-package) |
| `--watch` | Off | Debounce edits under the artifacts root or in referenced local source files and regenerate; ignores co-located `*.proxy.ts` writes, a dedicated nested output folder, and the generated metadata module. Backend edits inside a co-located nested output folder trigger regeneration. Stdout reports `Watch ready` after the initial generation and watcher registration, then `Watch change detected` when an edit schedules regeneration; referenced external files are also polled to recover missed directory notifications |

Output is co-located when it equals or contains the artifacts root, or when a nested output folder contains a discovered backend contributor: a command, read model, validator, resolved concept/model/enum, or class emitted in generated metadata (for example, `--artifacts src --output src/Features` with a validator in `Features`). An unrelated helper alone does not make a nested output co-located. Co-located output requires `--use-proxy-file-suffix` (generation fails without it) and writes no generated barrels. A handwritten `*.proxy.ts` collision fails before any files are published. Stale deletion affects only generator-owned files, not backend modules or components. Runtime discovery ignores the proxy suffix and `.tsx` components.

A genuinely dedicated output folder nested inside the artifacts root (for example, `--artifacts src --output src/generated` with no analyzed backend contributors in `generated`) retains separate-output behavior: barrels are written by default, the suffix is optional, and generated files are excluded from artifact analysis and watch regeneration. If the server also discovers the artifacts root at runtime, place dedicated output outside that root or use `--use-proxy-file-suffix` so runtime discovery does not import generated proxy modules.

## Map types to another package

When several packages share a model, generate it once and import it everywhere else. A mapped type is not written to the proxy tree; every command, query, and model that references it imports it from the package instead. Route names, output layout, and every other default stay the same.

```bash
arc-proxygenerator --project tsconfig.json --artifacts src --output src \
  --type-mapping Shared.Money=@acme/money \
  --type-mapping Shared.Amount=@acme/money#Money
```

The generated proxies then contain:

```typescript
import { Money } from '@acme/money';
```

The value is `<Type>=<package>[#<export>]`. Programmatic callers pass the same settings as `typeMappings` to `generateFromSource` and `analyzeSource`:

```typescript
await generateFromSource({
    project, artifacts, output,
    typeMappings: {
        'Shared.Money': { package: '@acme/money' },
        'Shared.Amount': { package: '@acme/money', export: 'Money' }
    }
});
```

| Part | Meaning |
| --- | --- |
| Type | The type's namespace-qualified name: the [root namespace](#route-alignment), then the folders between the artifacts root and its file, then the class or enum name. `Shared/Money.ts` under the artifacts root is `Shared.Money`. Segments to skip do not change it. The type is matched by its resolved declaration, not by how it is spelled at the use site, so an aliased import maps the same way |
| `package` | The npm package, optionally with a subpath, such as `@acme/money` or `@acme/money/models` |
| `export` | The symbol the package exports. Defaults to the type's own name; set it when the package uses a different name |

Behavior and limits:

- A mapped class or enum works as a field, an array element, a command or query result, or a base class. A mapped enum keeps its primitive runtime constructor.
- The package must export a class the generated code can use as a runtime constructor, decorated the way generated models are. It is imported as a value, including with `--emit-interfaces`. Install the package separately; the generator does not build or publish it.
- Only types below the artifacts root can be matched. The fields of a mapped type are not analyzed.
- Each type can be mapped once. A repeated `--type-mapping` for one type fails, and so does an invalid type name, package name, or export name.
- Generation fails, naming the file, when a mapped export would share a name with another import or declaration in the same generated file, for example a mapped `Command` next to the `Command` imported from `@cratis/arc/commands`. Export the type from your package under a different name.
- A mapping that matches no type reachable from the artifacts root is reported as a warning, since it is usually a misspelled name.

## Programmatic use

The package also exports `analyzeSource`, `renderSource`, `renderGeneratedMetadata`, and `generateFromSource` for the same pipeline, with the `SourceGeneratorOptions` and `SourceRenderOptions` types. Programmatic `generateFromSource` accepts `metadata` or `generatedMetadata: true` for inference. `renderSource` accepts a `recordedRules` override. The low-level manifest path exports `renderClientManifest` and `generateClient`; see [Low-level manifest](low-level-manifest.md).

## Related

- [Proxy generation](index.md)
- [File index tracking](file-index-tracking.md)
- [Generated artifact metadata](generated-artifact-metadata.md)
