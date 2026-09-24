---
title: Proxy generation
description: Generate typed @cratis/arc frontend proxies, React hooks, and client validation from your decorated TypeScript commands and read models.
---

A frontend that calls your commands and queries through hand-written `fetch` calls drifts from the server the first time someone renames a field. `arc-proxygenerator` reads your TypeScript project and writes typed proxies for the published `@cratis/arc` client: command and query classes, React hooks, models, and the client-safe part of your validators, with the same routes the server serves.

It reads source through the TypeScript compiler API. It never imports or runs your application, and it never talks to a running server.

:::note[Source preview]
`@cratis/arc.proxygenerator` is not published to npm. Run its CLI from a clone of this repository after `yarn build`.
:::

## Generate proxies for the Tasks sample

```sh
yarn install --immutable
yarn build
mkdir -p my-app/frontend/src/generated
node Source/Tools/ProxyGenerator/dist/cli.js \
  --project "$PWD/Samples/Tasks/tsconfig.json" \
  --artifacts "$PWD/Samples/Tasks/Features" \
  --output "$PWD/my-app/frontend/src/generated" \
  --use-generated-metadata \
  --use-proxy-file-suffix
```

The output folder must exist. You get one file per artifact, in folders that follow the namespace, plus a barrel per folder:

```text
Tasks/Listing/AllTasks.proxy.ts
Tasks/Listing/ObserveAllTasks.proxy.ts
Tasks/Listing/TaskById.proxy.ts
Tasks/Listing/TaskItem.proxy.ts
Tasks/Listing/index.ts
Tasks/Registration/RegisterTask.proxy.ts
Tasks/Registration/index.ts
```

The Tasks sample's `generate-proxies` script (`yarn workspace @cratis/arc.core.sample.tasks generate-proxies`) writes the same files to its ignored `dist/proxies` and compiles them.

## What a proxy looks like

An excerpt of the generated `RegisterTask.proxy.ts`:

```typescript
export class RegisterTask extends Command<IRegisterTask, Guid> implements IRegisterTask {
    readonly route: string = '/api/tasks/registration/register-task';
    readonly validation: CommandValidator = new RegisterTaskValidator();
    // ...properties, change tracking, and the React hook follow
}
```

The `TaskId` concept arrives in the frontend as its underlying `Guid`, and the validator carries the literal `notEmpty` and `maxLength` rules from `RegisterTaskValidator`. Your frontend creates a `RegisterTask`, sets `id` and `title`, and calls `execute()`, or uses `RegisterTask.use()` in a React component. See [Frontend](/arc/frontend/) on the shared Arc pages for the client side.

## Compatibility

The generated proxies compile against `@cratis/arc` and `@cratis/arc.react` 22.19.1 with `@cratis/fundamentals`, in strict `Bundler` mode with `skipLibCheck: false`. `yarn test:client-generation` builds the workspace, generates the Tasks proxies, compiles them, and runs commands, queries with arguments, paging, sorting, observable snapshots, and hub updates against live model-bound Express, Fastify, and Hono servers.

Imports between generated files are extensionless by default, for Vite and other bundlers. Use `--js-import-specifiers` for native Node ESM after compilation. `NodeNext` consumer compilation is not supported with the published client declarations.

## Limits

Compared with Arc's .NET proxy generator, this generator does not yet:

- discover identity-only types from identity details providers;
- support two reachable models with the same class name in different namespaces (it fails with `Ambiguous model name`);
- emit query HTTP method choices or command warning-severity settings (`treatWarningsAsErrors` is always `false`);
- reproduce every .NET output template.

Nullable command types and interface-only model mode have compile coverage only, not live-client equivalence. Do not treat this output as complete .NET proxy parity; the [capability reference](../reference/capabilities.md#proxies-introspection-and-tooling) tracks the details.

## Continue

- [Configuration](configuration.md): every CLI option.
- [Generated artifact metadata](generated-artifact-metadata.md): infer server bindings and validate them before startup.
- [Type mapping](type-mapping.md): which TypeScript types become which client types.
- [Validation rules](validation.md): which validator rules reach the client.
- [File index tracking](file-index-tracking.md): ownership headers, barrels, and stale-file cleanup.
- [Low-level manifest](low-level-manifest.md): proxies for `defineCommand` and `defineQuery`.
