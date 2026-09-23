---
applyTo: "**/*"
---

## Arc for TypeScript

This repository is the server-side, idiomatic TypeScript implementation of Arc for Node.js. It is a
**framework library** (framework profile in `framework.md`), not an application: never add vertical
slices, sample domains, read models, or UI code to framework source.

### Scope and design choices

- Consult existing records in `decisions/` before changing something they cover.
- Base package names, module layout, and public APIs on source evidence (Arc behavior, the HTTP
  contract, the existing client). Document a reversible choice with the implementation that makes
  it; it does not need a decision record first.
- Do not document a package name, API, or capability as available until it is implemented and
  verified.
- Express, Fastify, and Hono are intended host frameworks. None is implemented. Describe them as
  planned until an adapter exists and is verified.
- Chronicle and MongoDB are intended optional integrations. The core must never require event
  sourcing or a database.

### Reference implementation and parity

- Arc on .NET (`Cratis/Arc`, commonly the sibling checkout `../Arc`) is the reference. Its
  `Documentation/http-contract.md` is the language-neutral wire contract. `Cratis/Arc.Kotlin` is a
  precedent for a second-platform Arc and how it reports parity.
- Parity means matching observable behavior in idiomatic TypeScript, not porting .NET mechanics.
  Claim parity per area, only with a passing executable check behind it; an unverified area is
  reported as unverified.

### Boundaries

- `@cratis/arc` is the existing client runtime, built and released from `Cratis/Arc`. Never publish
  under that name, replace or repurpose it, or describe this repository as its successor. It is the
  compatibility target for this server's wire behavior.
- Sibling repositories (`Arc`, `Arc.Kotlin`, `Chronicle`, `Chronicle.TypeScript`, `Fundamentals`, and
  others) are read-only from here. Never edit them or copy their source, documentation, `.github`, or
  AI trees into this repository.
- Never edit files listed in `.cratis/ai.manifest.json`. Change shared guidance in `Cratis/AI`;
  project guidance belongs in this folder.

### Verification

- Run the relevant checks locally and name them in the final report to the user, not in the pull
  request description, which holds release notes only. A green hosted run does not replace local
  verification.
- Hosted CI may be triggered manually during bootstrap.

### Releases

- Minor and patch releases, and release-automation setup, may proceed once the local gates pass;
  they need no separate request.
- npm publication stays disabled until it is configured.
- No `major` release until full parity with Arc on .NET is verified **and** a human explicitly
  merges it. Never enable auto-merge on, or merge on someone's behalf, a pull request labeled
  `major`.
- Merge with a merge commit only (`gh pr merge --merge`). Never squash, rebase, or force-push.

### Work records

Plans, research, status boards, and handovers live only in the git-ignored `.ai-work/`; they are
never documentation and are never committed. Durable follow-ups become GitHub issues; durable
decisions go to `decisions/`.
