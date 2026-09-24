# Contributing to Arc for TypeScript

Thank you for helping. Arc for TypeScript is early source: the server core, three host adapters, an optional MongoDB read helper, a bounded client generator, an experimental Chronicle integration, and a sample exist, nothing is published to npm, and parity with Arc on .NET is incomplete. Public APIs can still change, so a short design conversation before a large change saves rework.

The [Cratis contribution guide](https://github.com/Cratis/.github/blob/main/contributing.md) and [code of conduct](https://github.com/Cratis/.github/blob/main/CODE_OF_CONDUCT.md) apply to this repository.

## Before you start

- **Open an issue first** for anything beyond a small fix, so the design is agreed before you build against it.
- **This is a framework library, not an application.** Do not add application-style structure such as vertical slices, sample domains, or UI code to `Source` or `Integrations`. Runnable examples belong in `Samples`.
- **Arc on .NET is the reference implementation.** Parity means matching its observable behavior, especially the [Arc HTTP contract](https://github.com/Cratis/Arc/blob/main/Documentation/http-contract.md), in idiomatic TypeScript. It does not mean copying .NET source or mechanics. Changes to Arc on .NET, or to the `@cratis/arc` client, belong in the [Arc](https://github.com/Cratis/Arc) repository.
- **`@cratis/arc` is the existing client runtime.** Do not publish under its name, replace it, or describe this repository as its successor. Packages from this repository use the `@cratis/arc.server` names.
- **Say what works, and nothing more.** Do not document a package, API, host framework, or parity area as available until it is implemented and verified. Mark planned work as planned.

## Repository layout

| Folder | Contents |
| --- | --- |
| `Source` | `@cratis/arc.server`, the host-independent core, with its specs in `Source/specs` |
| `Integrations/Express`, `Integrations/Fastify`, `Integrations/Hono`, `Integrations/Node` | The framework adapters and standalone Node host, each with specs in its `specs` folder |
| `Integrations/MongoDB` | The optional MongoDB read helper, with unit specs and a live replica-set spec |
| `Integrations/Chronicle` | The experimental Chronicle integration. It is `private` and must stay unpublished until the Chronicle SDK loads in Node.js and it has passed against a live Chronicle kernel. |
| `CodeGeneration` | `@cratis/arc.server.codegen`, which renders `@cratis/arc` proxies from an exported client manifest, and its JSON-only CLI |
| `Samples/Tasks` | A runnable sample hosted on Hono |
| `ContractTests/DotNET`, `ContractTests/Http` | A .NET reference host and the paired HTTP checks that compare it with Arc for TypeScript; see their READMEs |
| `ContractTests/Client` | Client generation tests: proxy fixtures compiled against the pinned `@cratis/arc`, `@cratis/fundamentals`, and `rxjs` versions, and generated proxies run against live Express, Fastify, and Hono hosts |
| `Documentation` | Product documentation published on the Cratis site |
| `scripts` | Release preview tooling and its specs |

## Set up

You need Node.js 22.19 or later and Corepack; Node.js 24 LTS is recommended. The root workspace declares Node.js `>=22.19.0` because it installs the Chronicle SDK, whose dependencies need it. The core, host adapter, and MongoDB packages declare Node.js 22 or later on their own. The repository pins Yarn 4 in `package.json`, and Corepack selects that version. If `corepack` is not available with your Node.js installation, install it with `npm install --global corepack`.

```bash
corepack enable
yarn install
yarn build
```

The workspaces link to each other, so the sample and the adapters use the local core.

## Verify your change

Run the complete local gate from the repository root before you open a pull request:

```bash
yarn ci
```

It runs, in order:

1. ESLint (`yarn lint`).
2. The type check (`yarn typecheck`): `tsc -b` for every package, then `tsc -p tsconfig.specs.json` for the specs.
3. The build (`yarn build`).
4. The client generation checks (`yarn test:client-generation:verify`): a strict `Bundler` compile of the proxy fixtures with `skipLibCheck: false`, then the generation tests with Node.js. Run `yarn test:client-generation` on its own to build first.
5. The Vitest specs (`yarn specs`), including the MongoDB unit specs and the Chronicle specs, which use typed substitutes and never load the Chronicle SDK.
6. Markdown lint for the README files and `Documentation` (`yarn docs:lint`).
7. The release guard specs (`node --test scripts/for_release/*.test.mjs`).

Run a single step while you work, and the whole gate before you push. Add or update a spec for every behavior you change.

Two checks need more than Node.js and are not part of `yarn ci`. Run them when you change what they cover:

- `yarn test:conformance` restores and builds the .NET reference host from its lock file, builds the workspace, and runs the 33 paired HTTP checks. It needs the .NET 10 SDK and the .NET and ASP.NET Core 10.0.11 runtimes.
- `bash Integrations/MongoDB/run-integration.sh` runs the live MongoDB spec in a disposable Docker container. It exits with 2 when Docker is not available, which means the check did not run.

A hosted run does not replace local verification. The hosted CI workflow is started manually.

## Conventions

- American English in code, comments, and documentation.
- Every source file starts with the Cratis license header:

  ```ts
  // Copyright (c) Cratis. All rights reserved.
  // Licensed under the MIT license. See LICENSE file in the project root for full license information.
  ```

- Formatting follows [`.editorconfig`](.editorconfig).
- TypeScript conventions, code quality, and specification style follow the Cratis rules under `.cratis/ai/rules/`.
- Public API changes come with updated documentation under `Documentation/`, with examples checked against the source.

## Pull requests and releases

- Keep pull requests small and focused, with commits that are each one logical change. Write commit subjects in the imperative mood.
- Write the pull request description as release notes for the people who will use the change. It describes the change, not the checks you ran.
- Maintainers merge with a merge commit. History is never squashed, rebased, or force-pushed.
- Label each pull request with its semantic-versioning impact: `major`, `minor`, or `patch`, or `no-release` when nothing a consumer can observe changes.
- **npm publishing is off.** Publishing to npm stays disabled until it is configured, and the Chronicle integration stays `private` even then until the conditions in the layout table are met. [Preview a TypeScript release](Documentation/contributing/releases.md) describes the release preview that exists today.
- **A `major` release needs full parity and a human merge.** No `major` release happens until full parity with Arc on .NET is verified and a maintainer explicitly merges it. Major releases are never merged automatically.

## AI-assisted contributions

This repository uses the managed [Cratis AI](https://github.com/Cratis/AI) corpus under `.cratis/ai/` and the harness folders that link to it.

- Do not edit managed files by hand. Improvements to shared rules and skills belong in the [Cratis AI](https://github.com/Cratis/AI) repository.
- Project-specific guidance lives in `.cratis/ai/rules/project/`.
- Plans, notes, and other working files stay in the git-ignored `.ai-work/` folder and are never committed. A follow-up that must outlive a session belongs in a GitHub issue.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
