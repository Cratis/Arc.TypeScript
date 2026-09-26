---
title: Change a sample
description: Regenerate proxies and metadata, lint, and check client generation after you change the Tasks or Library sample, and find where each Arc for .NET test-app behavior is covered in this repository.
---

The Tasks and Library samples in this repository are checked by the same gate as the packages. Both samples commit their generated metadata, and Library also commits its browser proxies, so a change to a decorated artifact has to be followed by a regeneration, or `yarn ci` fails. This page is for contributors to this repository; applications have their own scripts.

## After you change a slice

Run these from the repository root. The `generate-proxies` scripts run the proxy generator from its `dist` folder, so run `yarn build` first.

| Command | What it does |
| --- | --- |
| `yarn workspace @cratis/arc.core.sample.tasks generate-proxies` | Regenerates `Samples/Tasks/Features/generatedMetadata.ts`, and compiles the Tasks proxies into `dist/proxies` |
| `yarn workspace @cratis/arc.sample.library generate-proxies` | Regenerates `Samples/Library/Features/generatedMetadata.ts` and the proxies in `Samples/Library/Web/src/generated` |
| `yarn check:metadata` | Fails when either sample's committed metadata differs from its source |
| `yarn lint:tasks:arc` | Runs the Arc ESLint rules over `Samples/Tasks/Features` with type information |
| `yarn test:client-generation` | Builds, regenerates the Tasks proxies, compiles the client fixtures, and runs the generated proxies against Express, Fastify, and Hono |

Commit the regenerated files with the source change. Do not hand-edit generated metadata or browser proxies.

## Where the .NET test-app behaviors live

Arc for .NET exercises its hosts with two test applications in the Arc repository: `TestApps/ArcCore`, a standalone Arc.Core host, and `TestApps/AspNetCore`, an ASP.NET Core host with MongoDB and Swagger. Both share their features from `TestApps/Shared`. This repository has no test-app folders of the same name. Each behavior is covered by a sample, an adapter suite, or a contract check instead:

| Behavior | .NET reference (Arc 22.23.0) | Arc for TypeScript | Checked by |
| --- | --- | --- | --- |
| Standalone host without a web framework | `TestApps/ArcCore/Program.cs` | `Samples/Tasks/main.ts` with `app.run()` | `yarn build`, `yarn check:metadata` |
| Route prefix, skipped namespace segments, and command name in route | `ArcCore/Program.cs` options | `generatedApis` options | `Source/Core/for_ArcApplicationBuilder/when_building_model_bound_routes` |
| Model-bound command and read model | `Shared/ModelBoundCommand.cs`, `ModelBoundReadModel.cs` | `Samples/Tasks` `RegisterTask` and `TaskItem`; `Samples/Library` slices | Slice specs under each sample's `for_*` folders |
| Command validator | `AspNetCore/DoStuffValidator.cs` | `TaskTitleValidator` in Tasks; `AddBookValidator` in Library | `when_validating/with_an_empty_title`, `when_adding/with_an_empty_title` |
| Query by argument, paging, and sorting | `Shared/Features/QueryShowcase` | Tasks `taskById` and `allTasks`; Library `authorsPage` | `when_performing/with_a_concept_argument`, `with_sorting_and_paging`, Library `when_paging` |
| Observable queries | `Shared/Features/Ticker`, `LiveFeed`, `ObservableCollection`, `ChangeStream` | Tasks `observeAllTasks` (RxJS `BehaviorSubject`); Library `allAuthors` from Chronicle | Tasks `when_collecting/with_current_value`; `ContractTests/Client/observable-*.test.mjs` over SSE, WebSockets, and the hub |
| Authentication handlers | `Shared/Authentication` cookie and Microsoft identity platform handlers | `jwtBearer()` and `microsoftIdentityPlatform()`; a native principal in the Library host | `Source/Core/authentication/for_*`; `Source/Express/for_identityHosts` |
| Anonymous and authenticated queries, roles, and cross-cutting authorization filters | `Shared/Features/AuthenticationQueries`, `CrossCuttingAuthorization` | `@roles('Librarian')` in Library; authorization filters in Arc.Core | Library `with_librarian_role`, `without_librarian_role`; `yarn test:conformance` |
| Host adapters | `AspNetCore/Program.cs` (ASP.NET Core) | `@cratis/arc.express`, `@cratis/arc.fastify`, `@cratis/arc.hono`; Library runs on Express | `Source/{Express,Fastify,Hono}/for_cratisArc`; `yarn test:client-generation` runs generated proxies against all three |
| MongoDB collections and the change-stream watcher | `AspNetCore/Features/MongoWatcher` | `@cratis/arc.mongodb` `observe()` and `MongoDBWatcher` | `Source/MongoDB/run-integration.sh`, including `with_each_http_adapter` |
| React frontend with generated proxies | `ArcCore/main.tsx`, `AspNetCore/main.tsx`, `Shared/Features/*Page.tsx` | `Samples/Library/Web` | `yarn workspace @cratis/arc.sample.library test:e2e` exercises the proxies, not the browser UI |
| API description | Swagger UI through `Cratis.Arc.Swagger` | `GET /openapi.json`, without a bundled UI | `Source/Core/openApi/for_renderOpenApi` |

Three .NET behaviors have no counterpart by design:

- **Controllers.** `AspNetCore/Commands.cs`, `ObservableQueries.cs`, and `LiveFeedController.cs` use ASP.NET controllers. Arc for TypeScript serves only model-bound and low-level operations; routes you add to your host sit beside Arc.
- **Cookie authentication.** The shared `CookieAuthenticationHandler` is a .NET test fixture. Use your host's session handling and a [native principal](../hosts/native-principal.md).
- **`FromRequest` binding.** It is C#-only; see [OpenAPI](../open-api/index.md#topics).

Add a runnable sample only for a journey no sample, adapter suite, or contract check demonstrates yet, not to match a .NET folder name.

## Before you open a pull request

`yarn ci` runs all of the above with the rest of the gate. [Contributing](https://github.com/Cratis/Arc.TypeScript/blob/main/CONTRIBUTING.md) lists every step, and [Preview a TypeScript release](releases.md) covers release checks.

## Related

- [Keep a behavior together in a vertical slice](../vertical-slices.md)
- [Proxy generation](../proxy-generation/index.md)
