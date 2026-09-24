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
| `--output <folder>` | An existing output directory for the generated files |

## Route alignment

Match these to the server's [endpoint mapping](../core/endpoint-mapping.md), or generated clients call the wrong URL.

| Option | Default | Server equivalent |
| --- | --- | --- |
| `--root-namespace <namespace>` | None | `discover(folder, { rootNamespace })` |
| `--segments-to-skip <n>` | `0` | `generatedApis.segmentsToSkipForRoute` |
| `--api-prefix <prefix>` | `api` | `generatedApis.routePrefix` |
| `--skip-command-name-in-route` | Off | `generatedApis.includeCommandNameInRoute: false` |
| `--skip-query-name-in-route` | Off | `generatedApis.includeQueryNameInRoute: false` |

## Output

| Option | Default | Effect |
| --- | --- | --- |
| `--use-proxy-file-suffix` | Off | Name files `*.proxy.ts` instead of `*.ts` |
| `--js-import-specifiers` | Off | Use `.js` extensions in local imports, for native Node ESM; extensionless imports suit Vite and other bundlers |
| `--emit-interfaces` | Off | Emit undecorated interfaces instead of model classes; model constructors in proxies become `Object`, so choose this only when you do not need decorated model hydration |
| `--skip-index-generation` | Off | Do not write `index.ts` barrels |
| `--skip-output-deletion` | Off | Keep stale generated files instead of removing them |

## Programmatic use

The package also exports `analyzeSource`, `renderSource`, and `generateFromSource` for the same pipeline, with the `SourceGeneratorOptions` and `SourceRenderOptions` types. `renderSource` accepts a `recordedRules` override. The low-level manifest path exports `renderClientManifest` and `generateClient`; see [Low-level manifest](low-level-manifest.md).

## Related

- [Proxy generation](index.md)
- [File index tracking](file-index-tracking.md)
