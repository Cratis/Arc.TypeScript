---
title: Decorator reference
description: Every decorator and parameter descriptor you write on Arc for TypeScript artifacts, where it may go, what it changes, and the Arc on .NET attribute it corresponds to.
---

Arc for TypeScript discovers what your application exposes from decorators on your classes, the way Arc on .NET uses [attributes](/arc/backend/csharp/attributes/). This is the whole set, grouped by concern. Decorators come from `@cratis/arc.core` unless the table says otherwise. Both standard decorators and legacy `experimentalDecorators` are supported.

## Artifacts

| Decorator | Valid on | Effect | .NET |
| --- | --- | --- | --- |
| `@command({ namespace? })` | class | Marks a command; Arc exposes it and calls its instance `handle()` | `[Command]` |
| `@readModel({ namespace? })` | class | Marks a read model; its `@query()` static methods become queries | `[ReadModel]` |
| `@query(options?, ...descriptors)` | public static method of a read model | Marks a query; `options` is `{ observable?, argumentsModel? }` | Static method on a `[ReadModel]` |
| `@validator(Target)` | class extending `CommandValidator`, `QueryValidator`, `ConceptValidator`, or `ModelValidator` | Associates the validator with its exact target type | Discovered `AbstractValidator<T>` |

## Fields

| Decorator | Valid on | Effect | .NET |
| --- | --- | --- | --- |
| `@field(Type, ...)` from `@cratis/fundamentals` | public instance field | Declares the field and its wire type | The property's CLR type |
| `@key()` | field | The command key, and the storage identity of a read model | `[Key]` |
| `@optional()` | field | The field may be omitted on input | Nullable reference type |
| `@nullable()` | field | The field may be `null` | Nullable type |
| `@defaultValue(value)` | field | Omitted input takes this value | Default parameter value |
| `@enumeration(EnumObject)` | scalar field | Restricts the value to the members of an enum object | Enum-typed property |
| `@derivedType('id')` from `@cratis/fundamentals` | class | Registers a polymorphic subtype, written as `_derivedTypeId` | Fundamentals derived types |

## Routing

| Decorator | Valid on | Effect | .NET |
| --- | --- | --- | --- |
| `@path('/api/...')` | command or read-model class, `@query()` method | Overrides the derived route | `[Path]` |

There is no equivalent of `[QueryHttpMethod]` or `[FromRequest]`: queries accept GET and `QUERY`, and arguments bind from the query string or `QUERY` body.

## Authorization

| Decorator | Valid on | Effect | .NET |
| --- | --- | --- | --- |
| `@authorize()` | class, `@query()` method | Requires an authenticated caller | `[Authorize]` |
| `@authorize('Policy')` or `@authorize({ policy?, roles?, schemes? })` | class, `@query()` method | Requires a policy, any listed role, and/or a named scheme | `[Authorize(Policy = ...)]` |
| `@roles('A', 'B')` | class, `@query()` method | Requires at least one of the roles | `[Roles]` |
| `@allowAnonymous()` | class, `@query()` method | Allows everyone | `[AllowAnonymous]` |

Stacked declarations must all pass; a method declaration replaces its class declaration. Authorization on `handle()`, `provide()`, or a non-query static method fails at build.

## Services

| Decorator | Valid on | Effect | .NET |
| --- | --- | --- | --- |
| `@inject(...tokens)` | command `handle()` or `provide()` | One token or marker per parameter, in order | Method parameter injection |
| `@injectable(...tokens)` | class | Constructor dependencies; `static inject = [...] as const` is equivalent | Constructor injection |
| `@singleton()`, `@scoped()`, `@transient()` | class | Registers a discovered service with that lifetime | Service lifetime conventions |

## Extension points

| Decorator | Valid on | Effect |
| --- | --- | --- |
| `@commandResponseValueHandler()` | class implementing `CommandResponseValueHandler` | Registers a scoped [response value handler](commands/response-value-handlers.md) |
| `@queryRenderer()` | class implementing `QueryRenderer` | Registers a scoped [query renderer](queries/renderers.md) |
| `@readModelInterceptor()` | class implementing `ReadModelInterceptor` | Registers a scoped [read-model interceptor](queries/read-model-interception.md) |
| `@identityDetailsProvider()` | class implementing `IdentityDetailsProvider` | Registers the [identity details provider](identity/index.md) |

## Parameter descriptors

These are not decorators, but you pass them to `@query(...)` and `@inject(...)`:

| Descriptor | Used in | Binds |
| --- | --- | --- |
| `argument(name, Type, { optional?, elementType? })` | `@query` | A named query argument |
| `service(Token)` | `@query` | A service |
| `queryOptions()` | `@query` | The request's paging and sorting |
| `abortSignal()` | `@inject` | The request's `AbortSignal` |
| `commandContext()` | `@inject` | The `CommandContext` |
| `provided(Type)` | `@inject` on `handle()` | A value from `provide()`, by runtime type |
| `commandReadModel(Type, { optional? })` | `@inject` | A read model loaded by the command key |
| `mongoCollection(Model)` from `@cratis/arc.mongodb` | `service(...)` or `@inject` | The tenant's MongoDB collection |
| `drizzleReadModel(Model)`, `drizzleDatabase()` from `@cratis/arc.drizzle` | `service(...)` or `@inject` | The tenant's read-only SQL handle or writable database |

## Chronicle

From `@cratis/arc.chronicle` (experimental):

| Decorator | Valid on | Effect | .NET |
| --- | --- | --- | --- |
| `@eventSourceType('Type', { concurrency? })` | command class | Default event source type for returned events | Command event metadata |
| `@eventStreamType('Type', { concurrency? })` | command class | Default event stream type | Command event metadata |
| `@eventStreamId('id', { concurrency? })` | command class | Default event stream ID | Command event metadata |
| `@eventSubject('subject')` | command class | Default compliance subject | Command event metadata |
| `@notAudited()` | command field | Keeps the value out of the causation chain | `[NotAudited]` |

Event types, projections, and Chronicle read models use the SDK's own decorators, such as `@eventType()` from `@cratis/chronicle/events`.

## Related

- [Code analysis](code-analysis/index.md) for the ESLint rules that check decorator usage
- [Troubleshooting](troubleshooting.md) for decorator compiler settings
