---
title: Generate artifact metadata
description: Let Arc bind command and query parameters from TypeScript declarations without repeating class tokens in standard decorators.
---

TypeScript erases parameter types when it compiles a standard decorator. Generate server metadata from your artifact sources to keep the method declaration as the source of truth. The Tasks sample builds both client proxies and server metadata from the same project:

```bash
yarn tsc -b Source/Core Source/Tools/ProxyGenerator
yarn workspace @cratis/arc.core.sample.tasks generate-proxies
yarn build
```

The script passes `--project`, `--artifacts`, `--output`, and `--metadata Samples/Tasks/Features/generatedMetadata.ts` to `arc-proxygenerator`. The generated module is TypeScript, checked into the sample, and compiled along with the artifacts. `yarn build` checks its content against the current source and fails with a **regenerate artifact metadata** message when it is missing, changed, or stale. `yarn ci` regenerates before that check. Run the generator before a `tsx` development server or Vitest run that uses the artifacts; do not rely on the test runner to discover erased types.

Import the generated module and install it **before** discovery or `add()`:

```typescript
import { ArcApplication } from '@cratis/arc.core';
import { metadata } from './Features/generatedMetadata.js';
import { Tasks } from './Features/Tasks/Tasks.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
```

Now the [sample command](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Registration/RegisterTask.ts) uses `handle(tasks: Tasks)` without `@inject(Tasks)`, and a read-model method can use `@query() static taskById(id: TaskId, tasks: Tasks)`. Arc analyzes argument names and positions, concrete service classes, nullable/optional fields, validator targets, and the declared observable return. Keep `@field(Type)` on every wire property: that is the Cratis runtime schema convention, not redundant generated metadata. `provide()` still supplies one unmarked value as the first `handle()` argument; typed `provided(Type)` remains available for explicitly bound additional values.

For a development loop, run `arc-proxygenerator` with the same options plus `--watch`. It regenerates when a file beneath the artifacts root changes. Run it in a separate terminal before your `tsx` or Vitest command; do not run a watched generator as a one-shot CI step. Use `--check-metadata` with the same arguments for a read-only build gate. The programmatic `generateFromSource({ project, artifacts, output, metadata })` writes the same module, while `renderGeneratedMetadata(project, artifacts, metadataFile)` returns its deterministic text without writing it. Paths in the programmatic generator are absolute, and the output folder must exist.

Explicit decorators remain useful when you cannot run a build step: `@inject(Tasks)` and `@query(argument('id', TaskId), service(Tasks))` override inferred bindings. They also let you inject an interface by giving Arc a concrete class or `serviceToken` to resolve. The analyzer cannot invent a runtime value for an interface or erased type; it reports the file and line and asks for an explicit token. `@validator(Target)` similarly overrides inferred validator targets. Legacy `experimentalDecorators` with `emitDecoratorMetadata` still handles decorated class-valued parameters without generation; standard decorators need either generated metadata or explicit bindings.

The generated module records a version and each class's runtime-checkable shape (fields, method names, and arities). `useGeneratedMetadata` rejects an incompatible version or shape at build time. Source-only changes that erase to the same JavaScript shape, such as changing a parameter type without changing its arity, require the `--check-metadata` build gate: runtime reflection cannot see them. Do not edit the generated module; regenerate it. The analyzer supports concrete exported class tokens, primitives, concepts, arrays of wire values, and declared query observable sources. This is a bounded source-analysis path, not full parity with the .NET Roslyn generators; see [capabilities](../reference/capabilities.md).
