---
title: Glossary
description: One line per Arc for TypeScript term, with the decorator or function behind it and the page that covers it in full.
---

Terms shared by every Arc implementation are defined once in the [Arc glossary](/arc/glossary/). This page adds the TypeScript names for them, and the terms only Arc for TypeScript has.

## Commands

- **Command**: a class decorated `@command()` whose instance `handle()` method carries out an intent. See [Model-bound commands](../commands/model-bound/index.md).
- **`handle()`**: the command's method that decides and returns a response, events, operations, or nothing.
- **`provide()`**: an optional command method that runs after validation, before `handle()`, to load data `handle()` needs; its return value is `handle()`'s first argument.
- **Command key**: the value that identifies what a command acts on, from `@key()`, `getKey()`, or with Chronicle, `getEventSourceId()`. See [Command context](../commands/command-context.md#give-a-command-a-key).
- **Command context**: the command, its resolved key, request identity, and values, available to handlers through `commandContext()`. See [Command context](../commands/command-context.md).
- **Outcome**: a value created by `response(...)`, `rejected(...)`, or `denied(...)` that ends a command with a response, a 400, or a 403. See [Command outcomes](../commands/command-outcomes.md).
- **`tuple(...)`**: a return value that carries several values from `handle()`, at most one of which becomes the response.
- **Response value handler**: a `CommandResponseValueHandler` that consumes a returned value on the server, such as a Chronicle event. See [Response value handlers](../commands/response-value-handlers.md).
- **Command operation**: a returned `CommandOperation` that Arc executes and, after a known failure, compensates. See [Command operations](../commands/operations/index.md).

## Queries

- **Read model**: a class decorated `@readModel()` whose static `@query(...)` methods are queries. See [Model-bound queries](../queries/model-bound/index.md).
- **Parameter descriptor**: `argument(name, Type)`, `service(token)`, or `queryOptions()` in `@query(...)`, telling Arc where each query parameter comes from.
- **Observable query**: a query declared `@query({ observable: true }, ...)` that returns an RxJS observable or an async iterable, served as a snapshot, server-sent events, or WebSocket frames. See [Observable queries](../queries/observable-queries.md).
- **`queryPage(items, total, sorting?)`**: the result a query returns when its data source has already cut the page. See [Paging and sorting](../queries/model-bound/paging.md).
- **Read-model interceptor**: a `@readModelInterceptor()` class that transforms each read-model instance before it is encoded. See [Intercept read models](../queries/read-model-interception.md).

## Types and validation

- **Field**: a property declared with Fundamentals `@field(Type)`. Only declared fields are bound, validated, encoded, stored, and generated. See [Concepts](../concepts.md).
- **Concept**: a class extending Fundamentals `ConceptAs<T>` with `static readonly valueType`, wrapping one primitive domain value. See [Concepts](../concepts.md).
- **Validator**: a class extending `CommandValidator`, `QueryValidator`, `ConceptValidator`, or `ModelValidator`, decorated `@validator(Target)`, with rules declared by `ruleFor`. See [Command validation](../commands/command-validation.md).
- **Allowed severity**: the highest validation severity that does not block a command; over HTTP it is capped at Warning. See [Validation severity filtering](../commands/validation-severity-filtering.md).

## Services and hosting

- **Application builder**: the builder from `ArcApplication.createBuilder()` where you add or discover artifacts, register services, and attach integrations before `build()`. See [Dependency injection](../dependency-injection.md).
- **Discovery**: `builder.discover(folderUrl)`, which imports a folder and registers every exported, decorated artifact.
- **Service token**: a class, or a `serviceToken<T>(name)`, that identifies a service in Arc's container.
- **Generated metadata**: the file `arc-proxygenerator` writes so that a bare `@query()` or `handle()` can infer its arguments and services. See [Generated artifact metadata](../proxy-generation/generated-artifact-metadata.md).
- **`ArcServer`**: the built pipeline that executes commands and queries; hosts and `executeCommand`, `performQuery`, and `openObservableQuery` use it. See [Calling commands from code](../commands/calling-commands-from-code.md).
- **Host adapter**: `cratisArc` from `@cratis/arc.express`, `@cratis/arc.fastify`, or `@cratis/arc.hono`, which serves an Arc application inside that framework. See [Host adapters](../hosts/index.md).
- **Execution context**: the tenant, principal, correlation ID, allowed severity, and cancellation signal of one request or direct call.
- **Authentication handler**: an ordered handler that turns a request into a principal, such as `jwtBearer()`. See [Authentication](../core/authentication.md).
- **Identity details provider**: an `@identityDetailsProvider()` class whose result `/.cratis/me` returns. See [Identity](../identity/index.md).

## Client

- **Proxy**: a generated TypeScript class for one command or query that the published `@cratis/arc` client executes. See [Proxy generation](../proxy-generation/index.md).
- **`arc-proxygenerator`**: the CLI that reads decorated TypeScript source and writes proxies and generated metadata.

## Chronicle

- **Returned event**: an `@eventType()` instance returned from `handle()`, which the integration appends. See [Returning events](../chronicle/commands/index.md).
- **Batch**: the returned events of an outer command and its nested commands, appended together after the outer command succeeds. See [Transactional commands](../chronicle/commands/transactional-commands.md).
- **Concurrency scope**: the expected tail of an event source, set by `{ concurrency: true }`, `eventsWithConcurrencyScopes`, or an aggregate. See [Concurrency](../chronicle/commands/concurrency.md).
- **Subject**: the compliance identity recorded on an appended event, from `getSubject()`, `@subject()`, `@eventSubject`, or the event source ID. See [Subject](../chronicle/commands/subject.md).
- **Aggregate root**: a class extending `AggregateRoot`, bound with `commandAggregate(Type)`, rehydrated from the command key's events. See [Aggregates](../chronicle/aggregates/index.md).
- **Command read model**: a read model loaded for the command's key with `commandReadModel(Type)` or `readModelForValidation(Type)`. See [Read models in commands](../chronicle/read-models/injecting-into-commands.md).
- **Reactor command**: an Arc command returned from a Chronicle reactor and executed through the command pipeline. See [Returning commands from a reactor](../chronicle/reactors/command-side-effects.md).

## Storage

- **Collection token**: `mongoCollection(Type)`, the service token for the current tenant's MongoDB collection. See [Get started with MongoDB](../mongodb/getting-started.md).
- **Naming policy**: the `MongoNamingPolicy` that decides stored property and collection names. See [Naming policies](../mongodb/naming-policies.md).
- **Read handle**: `drizzleReadModel(Type)`, a read-only SQL handle for queries; `drizzleDatabase()` is the writable counterpart for commands. See [Get started with SQL](../sql/getting-started.md).
- **Column codec**: a conversion such as `guidCodec` or `conceptCodec`, wrapped in `pgColumn`, `mysqlColumn`, or `sqliteColumn`. See [Column types](../sql/column-types.md).
