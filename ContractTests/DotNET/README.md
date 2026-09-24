<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# .NET HTTP reference fixture

A standalone ASP.NET Core host using the **public** NuGet `Cratis.Arc` **22.22.0** package, not the sibling Arc checkout. Its package graph is pinned by `packages.lock.json` and its framework runtimes are pinned to .NET / ASP.NET Core **10.0.11**. Install .NET SDK 10.x and both 10.0.11 runtimes. It has no database, Chronicle dependency, or hand-written Arc response envelopes.

From the `Arc.TypeScript` repository root:

```sh
dotnet restore ContractTests/DotNET/HttpFixture.csproj --locked-mode
dotnet build ContractTests/DotNET/HttpFixture.csproj -c Debug --no-restore
dotnet run --project ContractTests/DotNET/HttpFixture.csproj -c Debug --no-restore
```

Startup prints one JSON readiness line (`kind: "typescript-dotnet-reference-ready"`, `baseUrl`, `package`, and runtime information). The host binds loopback on an OS-assigned port; use its reported `baseUrl`. An alternative after building is `dotnet ContractTests/DotNET/bin/Debug/net10.0/Arc.TypeScript.HttpFixture.dll`. Stop it with SIGTERM or Ctrl-C. Build intermediates and binaries remain under this fixture's ignored `obj/` and `bin/`. No global.json or sibling projects are needed.

All POST and QUERY bodies below are JSON (`Content-Type: application/json`). These are **observed callable routes**; Arc's introspection currently reports conventional paths that need not match custom `[Path]` query routes or the command route segment setting.

| Method / route | Input | Expected status / Arc result |
| --- | --- | --- |
| GET `/api/echo-count` | — | 200; `data.count` is the number of EchoValue handler executions |
| QUERY `/api/echo-count` | `{}` | 200; same count and `Cache-Control: no-store` |
| POST `/api/echo-value` | `{"value":"hello"}` | 200; `response.value` is `hello`; increments echo count by one |
| POST `/api/echo-value/validate` | `{"value":"hello"}` | 200; no handler response and no count increment |
| POST `/api/echo-value` or its `/validate` route | `{"value":""}` | 400; validation rule for `value`, no count increment |
| POST `/api/admin-echo` | `{"value":"ok"}` | 403 anonymous or with `X-Fixture-Role: Reader`; 200 with `X-Fixture-Role: Admin` |
| POST `/api/admin-echo` | `{"value":""}` | 403 for Reader without validation disclosure; 400 for Admin unless the .NET severity threshold suppresses the rule |
| POST `/api/throw-failure` | `{}` | 500; exception detail redacted in Production |
| GET `/api/items/by-id?id=2` | — | 200; `{ "id": 2, "name": "Grace" }` in `data` |
| QUERY `/api/items/by-id` | `{"arguments":{"id":2}}` | 200; same data and `Cache-Control: no-store` |
| GET `/api/items?page=0&pageSize=2` | — | 200; Ada, Grace; paging totalItems 3, totalPages 2 |
| QUERY `/api/items` | `{"paging":{"page":1,"pageSize":2}}` | 200; Linus; paging totalItems 3, totalPages 2; no-store |
| GET `/api/items/private` | — | 403 anonymous; 200 with `X-Fixture-Role: Admin` |

The fixed list is `(1, Ada), (2, Grace), (3, Linus)`. The echo execution counter starts at zero for each host process and is read-only over HTTP. In a sequential runner, read `/api/echo-count` before and after a valid `/api/echo-value/validate` to prove the handler was not invoked, then execute a valid `/api/echo-value` and assert the count increased by exactly one. A failed validation or command must not increment it either. There is no reset route; start a fresh host for independent runs. Query routes support both GET and QUERY. Send a valid `X-Correlation-ID` UUID to compare its response header with the envelope's `correlationId`. Only the literal `Reader` and `Admin` values authenticate in this **fixture-only** header scheme; never use it as application authentication. `/.cratis/commands` and `/.cratis/queries` expose Arc's ordinary introspection. This fixture is a reference host, not a cross-backend parity test.
