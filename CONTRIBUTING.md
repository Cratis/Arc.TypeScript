# Contributing to Arc for TypeScript

Thank you for helping. This repository is at the bootstrap stage: the architecture, package layout, and public API are still being decided, and there is no source code or build yet. This guide covers what applies now and will grow as tooling lands.

The [Cratis contribution guide](https://github.com/Cratis/.github/blob/main/contributing.md) and [code of conduct](https://github.com/Cratis/.github/blob/main/CODE_OF_CONDUCT.md) apply to this repository.

## Before you start

- **Open an issue first** for anything beyond a small fix. While the architecture is open, a design conversation saves you from building against a shape that is about to change.
- **This is a framework library, not an application.** Do not add application-style structure such as vertical slices, sample domains, or UI code to the framework source.
- **Arc on .NET is the reference implementation.** Parity means matching its observable behavior, especially the [Arc HTTP contract](https://github.com/Cratis/Arc/blob/main/Documentation/http-contract.md), in idiomatic TypeScript. It does not mean copying .NET source or mechanics. Changes to Arc on .NET, or to the `@cratis/arc` client, belong in the [Arc](https://github.com/Cratis/Arc) repository.
- **`@cratis/arc` is the existing client runtime.** Do not publish under its name, replace it, or describe this repository as its successor.
- **Say what works, and nothing more.** Do not document a package name, API, host framework, or parity area as available until it is implemented and verified. Mark planned work as planned.

## Conventions

- American English in code, comments, and documentation.
- Every source file starts with the Cratis license header:

  ```ts
  // Copyright (c) Cratis. All rights reserved.
  // Licensed under the MIT license. See LICENSE file in the project root for full license information.
  ```

- Formatting follows [`.editorconfig`](.editorconfig).
- TypeScript conventions, code quality, and specification style follow the Cratis rules under `.cratis/ai/rules/`.

## Verification

Run the relevant checks locally before you open a pull request. The [release preview guide](Documentation/contributing/releases.md) documents the release guard checks; runtime build and test commands are added alongside the implementation. A hosted run does not replace local verification; during bootstrap, maintainers may trigger hosted checks manually.

## Pull requests and releases

- Keep pull requests small and focused, with commits that are each one logical change. Write commit subjects in the imperative mood.
- Write the pull request description as release notes for the people who will use the change. It describes the change, not the checks you ran.
- Maintainers merge with a merge commit. History is never squashed, rebased, or force-pushed.
- Label each pull request with its semantic-versioning impact: `major`, `minor`, or `patch`, or `no-release` when nothing a consumer can observe changes.
- **npm publishing is off.** Publishing to npm stays disabled until it is configured.
- **A `major` release needs full parity and a human merge.** No `major` release happens until full parity with Arc on .NET is verified and a maintainer explicitly merges it. Major releases are never merged automatically.

## AI-assisted contributions

This repository uses the managed [Cratis AI](https://github.com/Cratis/AI) corpus under `.cratis/ai/` and the harness folders that link to it.

- Do not edit managed files by hand. Improvements to shared rules and skills belong in the [Cratis AI](https://github.com/Cratis/AI) repository.
- Project-specific guidance lives in `.cratis/ai/rules/project/`.
- Plans, notes, and other working files stay in the git-ignored `.ai-work/` folder and are never committed. A follow-up that must outlive a session belongs in a GitHub issue.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
