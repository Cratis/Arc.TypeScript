---
title: Change a sample
description: Regenerate proxies and metadata, lint, and check client generation after you change the Tasks or Library sample in this repository.
---

The Tasks and Library samples in this repository are checked by the same gate as the packages. Both samples commit their generated metadata, and Library also commits its browser proxies, so a change to a decorated artifact has to be followed by a regeneration, or `yarn ci` fails. This page is for contributors to this repository; applications have their own scripts.

## After you change a slice

Run these from the repository root. The `generate-proxies` scripts run the proxy generator from its `dist` folder, so run `yarn build` first.

| Command | What it does |
| --- | --- |
| `yarn workspace @cratis/arc.core.sample.tasks generate-proxies` | Regenerates `Samples/Tasks/Features/generatedMetadata.ts`, and compiles the Tasks proxies into `dist/proxies` |
| `yarn workspace @cratis/arc.sample.library generate-proxies` | Regenerates `Samples/Library/Features/generatedMetadata.ts` and the proxies in `Samples/Library/Web/src/generated` |
| `yarn check:metadata` | Fails when either sample's committed metadata differs from its source |
| `yarn lint:tasks:arc` | Runs the Arc ESLint rules over `Samples/Tasks/Features` with type information |
| `yarn test:client-generation` | Builds, regenerates the Tasks proxies, compiles the client fixtures, and runs the generated proxies against Express, Fastify, and Hono |

Commit the regenerated files with the source change. Do not hand-edit generated metadata or browser proxies.

## Before you open a pull request

`yarn ci` runs all of the above with the rest of the gate. [Contributing](https://github.com/Cratis/Arc.TypeScript/blob/main/CONTRIBUTING.md) lists every step, and [Preview a TypeScript release](releases.md) covers release checks.

## Related

- [Keep a behavior together in a vertical slice](../vertical-slices.md)
- [Proxy generation](../proxy-generation/index.md)
