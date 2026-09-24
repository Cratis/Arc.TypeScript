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
- Express, Fastify, and Hono adapters share the core pipelines. Test each adapter's real HTTP
  behavior; a core-only check does not establish adapter compatibility.
- Chronicle and MongoDB are optional integrations. The core must never require event sourcing
  or a database. Document each integration's actual consistency and lifecycle guarantees.
- `@cratis/arc.chronicle` is experimental and `private`. Keep it unpublished and do not
  describe it as a supported or live integration until the published Chronicle SDK imports in
  Node.js and the integration passes against a live Chronicle kernel. Specs with typed
  substitutes are not integration evidence.

### Reference implementation and parity

- Arc on .NET (`Cratis/Arc`, commonly the sibling checkout `../Arc`) is the reference. Its
  `Documentation/http-contract.md` is the language-neutral wire contract. `Cratis/Arc.Kotlin` is a
  precedent for a second-platform Arc and how it reports parity.
- Parity means matching observable behavior in idiomatic TypeScript, not porting .NET mechanics.
  Claim parity per area, only with a passing executable check behind it; an unverified area is
  reported as unverified.
- Some differences are deliberate safety choices, such as capping HTTP `X-Allowed-Severity` at
  Warning. Do not "fix" them toward .NET behavior; keep them documented in the capability
  reference and pinned in the paired HTTP checks.

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
- npm publication stays disabled until it is configured. Never run `npm publish` or an
  equivalent from a session.
- No `major` release until full parity with Arc on .NET is verified **and** a human explicitly
  merges it. Never enable auto-merge on, or merge on someone's behalf, a pull request labeled
  `major`.
- Merge with a merge commit only (`gh pr merge --merge`). Never squash, rebase, or force-push.

### Work records

Plans, research, status boards, and handovers live only in the git-ignored `.ai-work/`; they are
never documentation and are never committed. Durable follow-ups become GitHub issues; durable
decisions go to `decisions/`.
