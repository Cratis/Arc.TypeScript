# Run the Arc TypeScript tutorial end to end

From this repository root, with Node.js 22.19+, npm, Yarn 4, Python 3, Docker, and a checkout of Cratis/Arc:

```bash
yarn install --immutable
yarn build
ARC_DOCUMENTATION=/path/to/Arc/Documentation bash Documentation/tutorial-e2e/run.sh
```

Set `TUTORIAL_SCRATCH_PARENT=/path/outside/the/repos` to choose where the temporary application lives. By default it uses the system temporary directory. The runner packs the **built** local Arc packages with `yarn pack`, assembles backend code from the tutorial's TypeScript snippet tabs and browser code from the shared pages, installs the packages as the linked [create-an-application](../getting-started/create-an-application.md) guide prescribes, generates proxies, compiles `dist/main.js`, type-checks the frontend, and runs `vite build` with legacy decorators. It then starts an isolated MongoDB replica set and a loopback-only Arc backend on an ephemeral port. It checks HTTP authorization (401/403/200), author registration and observation, blank/duplicate-name rejection, per-author book filtering, and protected `RenameAuthor`. A nonzero exit is a failure; no checkpoint is optional. The runner stops its server and container and removes only its own temporary directory, including `node_modules`.

The authentication headers are a **development-only, loopback-only fixture**, not bearer-token verification. The script checks the generated frontend build, but it does not drive browser clicks. The shared tutorial describes the interactive dialog checks separately.

CI's `tutorial-e2e` job checks out the shared Arc tutorial from `Cratis/Arc` and runs this script whenever tutorial snippets, the checker, MongoDB/Core/generator source, or the workflow changes. If the Arc and TypeScript changes are separate pull requests, CI uses the currently merged Arc pages; run the command above against the Arc documentation worktree before either change lands.
