---
title: Prepare and publish a TypeScript release
description: Prepare a minor or patch source-preview version, check it, and publish it as a GitHub pre-release. Nothing is published to npm.
---

You prepare a source-preview version in the release pull request, and a maintainer publishes it as a GitHub pre-release after the merge. Nothing is automated: no workflow writes versions, tags, creates releases, or publishes to npm, and **npm publication is disabled**.

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

   The Chronicle and Drizzle consumer files skip library checks **only** for known third-party declaration errors. [CONTRIBUTING.md](https://github.com/Cratis/Arc.TypeScript/blob/main/CONTRIBUTING.md#upstream-declaration-errors) lists them.

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

## Publish the GitHub pre-release

A minor or patch release is a pull request that carries its `yarn set-version` commit, a `minor` or `patch` label, and user-facing release notes as its description. After hosted CI passes and the pull request is merged with a merge commit:

```bash
merge=$(gh pr view <number> --json mergeCommit -q .mergeCommit.oid)
git fetch origin
git merge-base --is-ancestor "$merge" origin/main
gh pr view <number> --json body -q .body > .ai-work/keep/release-notes.md
gh release create v<version> --prerelease --target "$merge" --title v<version> \
  --notes-file .ai-work/keep/release-notes.md
```

Create the release only after `git merge-base` confirms that the merge commit is on `main`, and target that commit, not the moving branch. `gh release create` also creates the `v<version>` tag, which the release preview workflow reads. The pre-release publishes source only; npm packages stay unpublished. Merge release pull requests in version order, because each carries its own `yarn set-version` change.

## Before enabling publication

Review the package inventory and versioning scheme, including whether any packages should stay private (none of the eleven packages under `Source` is marked `private`, including the experimental `@cratis/arc.chronicle` and `@cratis/cratis`; only the samples and contract-test fixtures are), verify every published manifest against the planned version, configure npm trusted publishing and a complete post-publish verification gate, and review failure behavior before granting write permissions or adding any release effect. A release must fail rather than report success after a partial publish. Neither this page nor the preview authorizes a publication workflow.

**Major releases are never automatic.** They require a human merge and may proceed only after Arc parity has been verified. A minor/patch preview is not a shortcut around those requirements. Merge pull requests with a true merge commit, not squash or rebase; merging and publishing are outside this workflow.
