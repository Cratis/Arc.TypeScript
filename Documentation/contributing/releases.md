---
title: Preview a TypeScript release
description: Validate a minor or patch release candidate without tagging, publishing, or creating a GitHub release.
---

You can prepare consistent source-preview versions locally and check a proposed release without publishing anything. This repository supports **release previews only**: automated version writes, npm publication, Git tags, and GitHub releases are not configured.

## Prepare a source-preview version

From the repository root, use `yarn set-version <MAJOR.MINOR.PATCH>` instead of editing manifests or prose by hand:

```bash
yarn set-version 0.20.0
yarn set-version --check
git diff --check
```

Replace the example with the intended version. The command updates `version` on the versioned workspace packages (the packages under `Source`, including `Source/Tools`, and `ContractTests/Client`); the Tasks sample and HTTP contract fixture remain unversioned. It updates non-`workspace:` internal server-package dependency, peer, and optional ranges to `^<version>`, leaving the externally published `@cratis/arc` client packages and workspace ranges alone. It also changes the preview-version statements in the README, documentation index, and package reference, then runs `yarn install` to refresh `yarn.lock`. Review the diff before committing; an install failure leaves edited files in place and fails the command so you can fix the issue and rerun it.

Only stable `MAJOR.MINOR.PATCH` values are accepted. A change of major version is refused unless you pass `--allow-major`; that flag does not grant release approval. Major releases still require verified full parity and an explicit human merge. `yarn set-version --check` reads without writing and verifies package versions, non-workspace internal ranges, and all three version statements. Pass a version to `--check` to require that specific version. The command fails if any expected statement is missing; its Node tests plant version and statement drift to check that failure path.

## Check a change locally

1. Write the pull request description for framework users. Keep only nonempty `## Added`, `## Changed`, `## Fixed`, `## Removed`, `## Security`, and `## Deprecated` sections, each with a specific bullet. Use `no-release` for documentation, CI, and other changes with no outward-facing effect. Do not submit a release preview for `no-release` work.
2. Run the release guard specifications:

   ```bash
   node --test scripts/for_release/*.test.mjs
   ```

3. Run the same build and test gate as the manual workflows:

   ```bash
   corepack enable
   yarn install --immutable
   yarn ci
   ```

   `yarn ci` also runs `yarn set-version --check` and `yarn check:consumers` after the build. It installs tarballs in disposable projects outside the workspace, checks public exports and package contents, type-checks NodeNext and Bundler consumers, and exercises native ESM HTTP and CLI usage (including core without optional RxJS). Run `yarn check:consumers --self-test` separately to prove the package-content guard rejects a planted violation. Neither check publishes a package. A passing guard specification alone does not mean the framework has passed CI.

   The core, host adapters, MongoDB, testing, proxy generator, and ESLint plugin consumer files use `skipLibCheck: false`. Chronicle and Drizzle consumer files use `skipLibCheck: true` **only** for third-party declaration errors; the script first runs their NodeNext compilation with `skipLibCheck: false`, prints the upstream diagnostics, and rejects errors in Arc declarations or consumer code. At the lockfile versions, `@cratis/chronicle.contracts@19.4.0` has `dist/esm/index.d.ts(1,15)` TS2834 (an extensionless relative export); this leaves `@cratis/chronicle@6.7.0` declarations such as `dist/connection/ChronicleConnection.d.ts(2,15)` with TS2305 (missing `ConnectionServiceClient`) and `ChronicleConnection.d.ts(60,62)` with TS2694 (missing `EventStoresClient`). `drizzle-orm@0.45.3` has `gel-core/columns/date-duration.d.ts(1,35)` TS2307 (missing `gel`) and `pg-core/query-builders/query.d.ts(23,22)` TS2420 (`PgRelationalQuery` lacks `getSQL`), among other internal declaration errors. Fix these in their owning packages before removing the temporary integration exception.

## Preview a candidate on GitHub

Run **Manual CI** on the intended commit. Save the verified user-facing notes from the merged pull request in a UTF-8 Markdown file, for example `.ai-work/keep/release-notes.md` (ignored). The file requires supported sections such as this illustrative format (not actual release notes):

```markdown
## Added
- Describe a specific public capability that shipped

## Fixed
- Describe a specific user-visible bug that was fixed
```

Replace both illustrative bullets with changes that actually shipped. Dispatch **Release preview (no publication)** from the current default branch; replace `main` below if that branch differs:

```bash
gh workflow run release-preview.yml --ref main \
  -F intent=patch \
  -F release_notes=@.ai-work/keep/release-notes.md
```

The `-F` flag reads the file contents, including newlines, as a single workflow input; `-f` would pass the `@` text literally. This command **starts a hosted workflow**: run it only when you intend to spend a CI run. An optional `-F expected_current_version=1.2.3` (without the `v`) makes the preview fail if the latest stable tag disagrees. The workflow runs the release guard specifications and `yarn ci` before printing its plan. It checks that the dispatch commit is still the default-branch head, reads existing `vMAJOR.MINOR.PATCH` tags, and computes the next tag. With no tags, it starts from `0.0.0`. Other tag shapes, placeholder or empty notes, a stale branch head, and any attempt to enable npm publishing fail closed.

The workflow is **manual only**, not triggered by pushes or pull requests. The preview uses read-only permissions and prints a plan; it does not update package manifests, apply labels, tag, create a release, or publish to npm. The displayed version is derived from Git tags alone. The separate `yarn set-version --check` gate verifies local manifest and documentation consistency, but the preview does **not** establish that its proposed tag matches the manifest version or that any package is ready to publish. Do not describe a preview as a completed release.

## Before enabling publication

Review the package inventory and versioning scheme, including whether any packages stay private (the experimental Chronicle integration has not been `private` since v0.12.0), verify every published manifest against the planned version, configure npm trusted publishing and a complete post-publish verification gate, and review failure behavior before granting write permissions or adding any release effect. A release must fail rather than report success after a partial publish. Neither this page nor the preview authorizes a publication workflow.

**Major releases are never automatic.** They require a human merge and may proceed only after Arc parity has been verified. A minor/patch preview is not a shortcut around those requirements. Merge pull requests with a true merge commit, not squash or rebase; merging and publishing are outside this workflow.
