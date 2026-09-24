---
title: Preview a TypeScript release
description: Validate a minor or patch release candidate without tagging, publishing, or creating a GitHub release.
---

You can check a proposed release without changing a package or publishing anything. This repository currently supports **release previews only**: npm publication, version writes, Git tags, and GitHub releases are not configured.

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

   `yarn ci` also runs `yarn check:consumers` after the build. It installs tarballs in a disposable project outside the workspace, checks public exports and package contents, type-checks NodeNext and Bundler consumers, and exercises native ESM HTTP and CLI usage. Run `yarn check:consumers --self-test` separately to prove the package-content guard rejects a planted violation. Neither check publishes a package. A passing guard specification alone does not mean the framework has passed CI.

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

The workflow is **manual only**, not triggered by pushes or pull requests. The preview uses read-only permissions and prints a plan; it does not update package manifests, apply labels, tag, create a release, or publish to npm. The displayed version is derived from Git tags alone. It does **not** establish that all package manifest versions match or that any package is ready to publish. Do not describe a preview as a completed release.

## Before enabling publication

Agree on the package inventory and versioning scheme, including whether any packages stay private (the experimental Chronicle integration has not been `private` since v0.12.0), verify every published manifest against the planned version, configure npm trusted publishing and a complete post-publish verification gate, and review failure behavior before granting write permissions or adding any release effect. A release must fail rather than report success after a partial publish. Neither this page nor the preview authorizes a publication workflow.

**Major releases are never automatic.** They require a human merge and may proceed only after Arc parity has been verified. A minor/patch preview is not a shortcut around those requirements. Merge pull requests with a true merge commit, not squash or rebase; merging and publishing are outside this workflow.
