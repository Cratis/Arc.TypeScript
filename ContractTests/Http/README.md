<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Paired HTTP contract checks

These black-box checks start the **published** Cratis.Arc 22.22.0 .NET fixture and a separate Node process using the **built** `@cratis/arc.server` package mounted in real Express 5 via `@cratis/arc.server.express`. Both bind ephemeral loopback ports and are terminated on completion or interruption. The fixture code defines the same commands, queries, role headers and in-memory data; it does not synthesize Arc response envelopes. The runner sends identical requests with a fixed correlation ID (except the invalid-correlation case), asserts independent expected statuses and complete JSON envelopes for each host, then compares the selected protocol response headers and envelope fields without stripping flags, data, paging or keys.

From the repository root, with Node >=22, .NET SDK 10.x, .NET/ASP.NET Core runtimes 10.0.11 and workspace dependencies already installed:

```sh
dotnet restore ContractTests/DotNET/HttpFixture.csproj --locked-mode
dotnet build ContractTests/DotNET/HttpFixture.csproj -c Debug --no-restore
yarn build
node --test ContractTests/Http/conformance.test.mjs
```

`ContractTests/Http/package.json` declares private fixture dependencies and is included in the root workspace. Do not build against an Arc sibling checkout. The runner launches the built .NET DLL directly and requires the .NET readiness JSON; a missing binary or unavailable import is a test failure, not a skip. Child startup and HTTP requests have deadlines, child output is bounded and included on startup failure.

Coverage is deliberately limited to the listed fixture routes: command execution and validation-only nonexecution (verified with the count query), business-rule and malformed-input rejection, authenticated role denial without validation leakage, allowed roles, GET and QUERY argument binding, paging, QUERY sorting and `Cache-Control: no-store`, production exception redaction, missing routes, 405/`Allow`, ignored unknown command properties, and correlation propagation/replacement. It is **not** full Arc parity, a security audit or a replacement for the runtime and integration specs.

## Observed non-parity (asserted, not normalized)

The suite prints `UNSUPPORTED PARITY` diagnostics with actual responses for these pinned observations; each side has a separate explicit expectation and the test fails if either changes unexpectedly:

- Anonymous role-protected command: ASP.NET Arc returns 403; TypeScript authentication ingress returns 401. An authenticated `Reader` receives 403 from both and cannot see validation results.
- An authenticated administrator with an invalid command still receives the business-rule error. With `X-Allowed-Severity: 3`, .NET 22.22.0 suppresses that error and executes; TypeScript caps the HTTP threshold at Warning and retains the error. This is an intentional safety difference.
- Malformed JSON or wrong-typed command value: both return 400 with `reason: malformedRequest`, but .NET says `The request body could not be read or is not valid for this command.` and TypeScript says `Malformed request`.
- Production exception: both return 500 with no response and an empty stack, but .NET's redacted message is `An internal error occurred while processing the request. See server logs for details.` and TypeScript's is `An unexpected error occurred`.
- GET `/api/items?sortBy=name&sortDirection=desc` on the pinned .NET fixture returns Ada/Grace (unsorted) while TypeScript returns Linus/Grace. The equivalent structured `QUERY` request sorts and pages identically in both.
- Unknown route: both return 404; ASP.NET returns an empty body and correlation header, while Express returns its default HTML 404 with no Arc correlation header.

No source/version/package fields are rewritten. The only value normalized for a parity assertion is a newly generated UUID for an invalid correlation header, after checking that it is a nonempty UUID echoed identically in that host's response header and envelope. Exact production redaction and all other messages are asserted rather than discarded. Host-only readiness metadata (package/runtime paths) is not part of HTTP comparisons.
