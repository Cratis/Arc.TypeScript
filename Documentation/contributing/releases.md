---
title: Prepare and publish a TypeScript release
description: Release Arc for TypeScript by labeling and merging a pull request; a workflow sets the version, creates the GitHub release and publishes every package to npm.
---

A release is a pull request. Label it `major`, `minor`, `patch`, or `no-release`, write its description as the release notes, and merge it to `main` with a merge commit. The publish workflow does the rest; you do not edit versions, create tags, or run `npm publish`.

## How a release runs

Merging a labeled pull request to `main` runs `.github/workflows/publish.yml`:

1. `cratis/release-action` reads the label, computes the next version from the existing releases, and creates the GitHub release with the pull request description as its notes. A `no-release` pull request creates no release and publishes nothing.
2. A publish job runs `node scripts/set-version.mjs <version> --allow-major`, which writes the version into every versioned workspace manifest, the internal dependency ranges, and the three documentation version statements.
3. The job then runs `node scripts/publish-npm.mjs`. It packs every non-private workspace package and publishes them in dependency order through npm trusted publishing (OIDC) with provenance. It skips any version already on the registry, so a re-run after a partial failure publishes only what is missing.

The publish job sets the version in its own checkout, so do not bump versions in a feature pull request. Run `yarn set-version --check` to verify that manifests, internal ranges, and the version statements agree with each other. `yarn set-version <MAJOR.MINOR.PATCH>` accepts only stable versions, refuses a major change without `--allow-major`, and updates the three statements (README, documentation index, and package reference) and `yarn.lock`.

## Labels and approval

- Pick exactly one of `major`, `minor`, `patch`, or `no-release` when you create the pull request. Use `no-release` for documentation, CI, and other changes with no outward-facing effect.
- **Major releases are never automatic.** A maintainer must explicitly merge a pull request labeled `major`; never enable auto-merge on one or merge it on someone's behalf. `--allow-major` lets the script write the version; it grants no approval.
- Merge with a merge commit, not squash or rebase.
- Write the description for framework users: only nonempty `## Added`, `## Changed`, `## Fixed`, `## Removed`, `## Security`, and `## Deprecated` sections, each with specific bullets. It is published verbatim as the release notes.

## Check a change locally

1. Write the pull request description for framework users. Keep only nonempty `## Added`, `## Changed`, `## Fixed`, `## Removed`, `## Security`, and `## Deprecated` sections, each with a specific bullet. Use `no-release` for documentation, CI, and other changes with no outward-facing effect. Do not submit a release preview for `no-release` work.
2. Run the release guard specifications:

   ```bash
   node --test scripts/for_release/*.test.mjs
   ```

3. Run the same build and test gate as the hosted CI workflow:

   ```bash
   corepack enable
   yarn install --immutable
   yarn ci
   ```

   `yarn ci` also runs `yarn set-version --check` and `yarn check:consumers` after the build. It installs tarballs in disposable projects outside the workspace, checks public exports and package contents, type-checks NodeNext and Bundler consumers, and exercises native ESM HTTP and CLI usage (including core without optional RxJS). Run `yarn check:consumers --self-test` separately to prove the package-content guard rejects a planted violation. Neither check publishes a package. A passing guard specification alone does not mean the framework has passed CI.

   The Chronicle and Drizzle consumer files skip library checks **only** for known third-party declaration errors. [CONTRIBUTING.md](https://github.com/Cratis/Arc.TypeScript/blob/main/CONTRIBUTING.md#upstream-declaration-errors) lists them.

## Optional dry run: release preview

The release preview is an optional dry run. It never publishes, tags, or creates a release. Save the verified user-facing notes from the merged pull request in a UTF-8 Markdown file, for example `.ai-work/keep/release-notes.md` (ignored). The file requires supported sections such as this illustrative format (not actual release notes):

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

## After a release

Check that the GitHub release exists and that `npm view @cratis/arc.core version` shows the new version. The Chronicle integration (`@cratis/arc.chronicle`) and `@cratis/platform` are published with every release but stay documented as bounded in the [capability reference](../reference/capabilities.md). If the publish job fails after some packages are published, re-run it: the script skips versions already on the registry. A release must fail rather than report success after a partial publish.
