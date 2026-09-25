---
title: Diagnostics
description: Every place Arc for TypeScript reports a problem, from lint rules and proxy generation to build errors, validation reasons, HTTP status codes, and the endpoints and telemetry of a running server.
---

Arc reports a problem at the earliest point it can see it. A binding mistake shows in the editor, a missing service stops `build()`, a bad request answers 400 with a reason, and a running server can describe what it serves. This page lists each of those surfaces and what it tells you. For step-by-step fixes of common problems, see [Troubleshooting](../troubleshooting.md).

## In the editor: lint rules

`@cratis/eslint-plugin-arc-core` checks model-bound artifacts before you build. Both presets, `recommended` and `recommended-type-checked`, report every rule as an error except `query-argument-name`, which you turn on yourself. Rules that match a .NET analyzer keep its `ARC` code. Setup is in [Code analysis](../code-analysis/index.md).

| Rule | Reports |
| --- | --- |
| [`arc0002`](../code-analysis/ARC0002.md) | A command-like class without `@command()` |
| [`arc0003`](../code-analysis/ARC0003.md) | Command handling outside the command |
| [`arc0004`](../code-analysis/ARC0004.md) | A command without a public instance `handle()` |
| [`arc0005`](../code-analysis/ARC0005.md) | A value from `provide()` that `handle()` never consumes |
| [`arc0010`](../code-analysis/ARC0010.md) | A synchronous command result wrapped in a promise |
| [`arc0012`](../code-analysis/ARC0012.md) | A built-in error thrown from an artifact |
| [`arc0014`](../code-analysis/ARC0014.md) | A query with type parameters |
| [`arc0015`](../code-analysis/ARC0015.md) | An incoming parameter converted to a concept inside the query |
| [`arc0019`](../code-analysis/ARC0019.md) | `@allowAnonymous()` combined with `@authorize()` or `@roles()` |
| [`missing-field`](../code-analysis/missing-field.md) | A model-bound property without `@field` |
| [`declared-field`](../code-analysis/declared-field.md) | A decorated field that would not be emitted |
| [`inject-binding`](../code-analysis/inject-binding.md) | `@inject` tokens that do not match the handler's parameters |
| [`query-binding`](../code-analysis/query-binding.md) | `@query` descriptors that do not match the method's parameters |
| [`query-argument-name`](../code-analysis/query-argument-name.md) | A query wire name that differs from its parameter name (opt-in) |
| [`misplaced-decorator`](../code-analysis/misplaced-decorator.md) | An Arc decorator on an artifact that does not support it |
| [`unexported-artifact`](../code-analysis/unexported-artifact.md) | A decorated artifact that discovery cannot see because it is not exported |
| [`validator-target`](../code-analysis/validator-target.md) | A validator without `@validator(Target)` when no generated metadata names it |

There are no rules for the Chronicle integration; [Chronicle code analysis](../chronicle/code-analysis.md) says what to check in review instead.

## At generation: arc-proxygenerator

- The CLI exits with code 1 and prints the error when generation fails, such as for a type it cannot map or a dynamic decorator option. See [Type mapping](../proxy-generation/type-mapping.md).
- A validator rule that needs server evaluation, such as `must` or `when`, stays on the server, and the generator prints a diagnostic naming it. See [Validation rules](../proxy-generation/validation.md).
- `--check-metadata` compares the generated metadata file with the source and fails when they differ, without generating anything; it prints `Generated artifact metadata is current` when they match. See [Generated artifact metadata](../proxy-generation/generated-artifact-metadata.md).

## At startup: build() and registration

`builder.add(...)`, the `with...` integrations, and `builder.build()` refuse an application that cannot run correctly, instead of failing on the first request. Typical messages:

| Message | Meaning |
| --- | --- |
| `Not an Arc artifact: <Type>` | A class passed to `add()` has no Arc or integration decorator |
| `Conflicting namespaces for <Type>` | One class was registered under two different namespaces |
| `Duplicate validator target: <Type>` | Two validators target one class |
| `Unbound handle parameters on <Type>.handle; use builder.useGeneratedMetadata(metadata) or @inject(...); default and rest parameters require explicit binding` | A command's `handle()` has parameters without generated metadata or `@inject(...)` tokens; see [Troubleshooting](../troubleshooting.md#build-fails-with-unbound-handle-parameters-or-missing-parameter-metadata) |
| `Unbound provide parameters on <Type>.provide; use builder.useGeneratedMetadata(metadata) or @inject(...); default and rest parameters require explicit binding` | The same for a command's `provide()` |
| `Unbound parameters on <Type>.<method>` | A query's `@query(...)` descriptors do not cover every parameter of the method |
| `Missing parameter metadata for <Type>.<method>; use explicit tokens` | A bare `@query()` or an empty `@inject()` on a method with parameters, without generated metadata, in standard decorator mode |
| `Unbound constructor parameters on <Type>` | A service's constructor parameters have no tokens |
| `Service <Token> requires an implementation` | A `serviceToken` was registered without a class or factory |
| `Missing service: <Token>` | A declared dependency is not registered |
| `Service dependency cycle: <Token>` | Services depend on each other in a loop |
| `Captive service dependency: <Token>` | A singleton depends on a scoped or transient service |
| `Expected one read-model resolver for <Type>, found <n>` | A `commandReadModel(Type)` has no owning integration, or two; see [When read model resolution fails](../chronicle/read-models/failures.md) |
| `Multiple identity details providers found` | More than one `@identityDetailsProvider()` |
| `Import @cratis/arc.<name> before calling with<Name>()` | An integration method was called without importing its package |
| `Chronicle requires eventStore and exactly one of connectionString or client` | Incomplete `withChronicle` options or configuration |
| `MongoDB requires exactly one of client, server, or serverResolver` | Incomplete `withMongoDB` options or configuration |
| `Drizzle requires exactly one of database or databaseFactory` | Incomplete `withDrizzle` options |
| `Invalid Cratis configuration: <path>.<problem>` | An `appsettings.json` or `Cratis__...` value has the wrong type; the message names the key, never the value |

The service messages are explained in [Dependency injection](../dependency-injection.md).

## At request time: results and status codes

A command or query result carries `validationResults`, and each result has a `reason`:

| `reason` | Meaning |
| --- | --- |
| `rule` | A validator rule failed, or a required command read model is missing or has no key |
| `malformedRequest` | The input does not match the declared fields |
| `validatorFailed` | A validator threw; the error goes to `logger`, and the caller sees a generic message without the exception text |
| `dependencyUnavailable` | A service a validator or handler needs could not be resolved |
| `constraintViolation` | Chronicle rejected an append for a constraint; `reasonDetail` names it |
| `concurrencyViolation` | Chronicle rejected an append because the stream moved; `state` holds the revisions |

The HTTP status follows the [HTTP contract reference](http-contract.md#status-codes): 400 for validation, 401 and 403 for authentication and authorization, 405 for an unsupported method, 408 and 503 for observable waits and limits, and 500 for exceptions. Outside development, a 500 carries `An unexpected error occurred` and no stack trace; the original error goes to the `logger` option. See [Configuration](../configuration/index.md#errors-and-logging).

## On a running server

| Surface | Shows |
| --- | --- |
| `GET /.cratis/commands`, `GET /.cratis/queries` | Every command and query with its route and input JSON Schema; see [Introspection](../introspection/index.md) |
| `GET /.cratis/identity-details/schema` | The identity details schema |
| `GET /openapi.json` | The OpenAPI 3.1 document; see [OpenAPI](../open-api/index.md) |
| `GET /.cratis/queries/health` | The authenticated caller's own observable hub connections, when `query.enableObservableHealth` is on; see [Query health](../queries/query-health.md) |
| OpenTelemetry | Spans such as `cratis.arc.command.execute` and the `cratis.arc.operation.duration` histogram from the `Cratis.Arc` source; see [Observability](../observability.md) |
| `logger(error, correlationId)` | Every failure with its correlation ID, and unknown configuration keys |

Every response carries its correlation ID, in `X-Correlation-ID` unless you renamed the header. Search your logs and traces by it.

For the Chronicle side of a running system, such as failed observer partitions, use the Chronicle Workbench or the `cratis` CLI against the same event store and tenant namespace.

## Related

- [Troubleshooting](../troubleshooting.md)
- [Capability reference](capabilities.md)
- [Glossary](glossary.md)
