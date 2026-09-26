---
title: Identity contracts
description: Reference for the IdentityDetailsProvider contract, its two registrations, the Principal and ExecutionContext it receives, the /.cratis/me response shape, and how the principal-first trust model differs from Arc on .NET.
---

This page lists the exact shapes involved in identity details: what your provider implements, what it receives, what `/.cratis/me` returns, and where each rule lives in the source. For the walkthrough, read [Identity](index.md) and [How identity details are served](provider-flow.md).

## IdentityDetailsProvider

Source: `Source/Core/identity/IdentityDetailsProvider.ts`. Import the type from `@cratis/arc.core`.

| Member | Type | Meaning |
| --- | --- | --- |
| `detailsType` | A class with `@field` declarations | The shape of `details`; Arc derives its schema from the fields |
| `schema` | `z.ZodType` | An explicit Zod schema for `details`; used instead of `detailsType` when both are set |
| `provide(principal, context)` | Returns `unknown` or `Promise<unknown>` | Returns the details, or `undefined` to deny the caller |

A provider must declare `detailsType` or `schema`, and a `provide` function. Otherwise `build()` fails with `Identity details require a provider schema` (`Source/Core/validateOptions.ts`). Prefer `detailsType`: the proxy generator turns it into a frontend class.

## Registration

| Registration | How | Instances |
| --- | --- | --- |
| Decorated class | `@identityDetailsProvider()` on a class, added with `builder.add(...)` or found by `builder.discover(...)` | A new instance for every request, constructed with no arguments |
| Option object | `identityDetails: { detailsType, provide }` or `{ schema, provide }` in `ArcApplication.createBuilder(...)` or `new ArcServer(...)` | The object you pass |

Sources: `Source/Core/identity/discoverIdentityDetails.ts`, `Source/Core/build/buildRegistered.ts`, and `identityDetails` in `Source/Core/ArcOptions.ts`.

`build()` fails when you supply both an option object and a decorated class (`Explicit and discovered identity details providers cannot be combined`), and when discovery finds more than one decorated class (`Multiple identity details providers found`).

A decorated class has no constructor injection. Resolve services inside `provide` with `currentServices()`; Arc runs `provide` in a service scope created for the request and disposes it afterwards.

## What provide receives

`Principal` (`Source/Core/identity/Principal.ts`), produced by your [authentication handler](../core/authentication.md) or a [native principal](../hosts/native-principal.md):

| Property | Type |
| --- | --- |
| `id` | `string` |
| `name` | `string`, optional |
| `roles` | `readonly string[]` |
| `isAuthenticated` | `boolean` |
| `claims` | `unknown`, optional |
| `scheme` | `string`, optional |

`ExecutionContext` (`Source/Core/execution/ExecutionContext.ts`, also exported from `@cratis/arc.core`) carries `correlationId`, `principal`, `tenantId`, `remoteAddress`, `signal`, and `allowedSeverity`. Tenant resolution has already run, so `context.tenantId` is the tenant this request selected.

## The /.cratis/me response

Source: `Source/Core/http/handleIdentity.ts`. The endpoint is mapped only when a provider is registered (`Source/Core/http/createRouteTable.ts`).

| Property | Value |
| --- | --- |
| `id` | `principal.id` |
| `name` | `principal.name`, or `""` when the principal has none |
| `isAuthenticated` | Always `true` |
| `isAuthorized` | Always `true` |
| `roles` | `principal.roles` |
| `details` | What `provide` returned, parsed by the provider's schema |

Every other outcome is a status code, not an identity with a `false` flag:

| Outcome | Status and body |
| --- | --- |
| No authenticated principal, or the credential was rejected | 401 `{"error":"Unauthorized"}` |
| Tenant missing or invalid, including a missing tenant with `tenancy.required` | 400 `{"error":"Invalid tenant request"}` |
| Not a member under `tenancy.membershipClaim` | 403 `{"error":"Forbidden"}` |
| `provide` returned `undefined` | 403 `{"error":"Forbidden"}` |
| `provide` threw, the details failed the schema, or the cookie would exceed 4096 bytes | 500 `{"error":"An unexpected error occurred"}` |

Every answer carries `Cache-Control: no-store`. A 200 also sets `.cratis-identity=<base64 JSON>; Path=/; SameSite=Lax`, plus `Secure` on a trusted HTTPS transport. The cookie holds the same JSON as the body, with non-ASCII characters escaped. `GET /.cratis/identity-details/schema` returns the JSON Schema of `details`.

## Principal first, cookie never

The server never reads `.cratis-identity`. Each call to `/.cratis/me` authenticates the request, resolves the tenant, and runs `provide` again (`Source/Core/http/handleRequest.ts`). The cookie is a display cache for the browser client, and commands and queries authorize against the verified principal only.

Arc on .NET works differently, and Arc for TypeScript deliberately does not copy it. In Arc 22.23.0, the .NET `/.cratis/me` endpoint returns a nonempty `.cratis-identity` cookie's content before it consults the provider (`Source/DotNET/Arc.Core/Identity/IdentityProvider.cs`), and `IIdentityProvider.ModifyDetails` rewrites that cookie. Because the cookie is unsigned and editable by JavaScript, that path lets a browser choose what `/.cratis/me` reports. Arc for TypeScript has no such path, and no server-side way to modify details. To store a user preference, send a command, keep the value in your own storage, and return it from `provide`.

## Compared with Arc on .NET

| Concern | Arc on .NET | Arc for TypeScript |
| --- | --- | --- |
| Provider contract | `IProvideIdentityDetails.Provide(IdentityProviderContext)` | `IdentityDetailsProvider.provide(principal, context)` |
| Provider input | `IdentityProviderContext`: `Id`, `Name`, and `Claims` as string pairs | `Principal` with `roles` and structured `claims`, plus the `ExecutionContext` |
| Provider output | `IdentityDetails(IsUserAuthorized, Details)` | The details, or `undefined` to deny |
| Details shape | Any object | Validated against `detailsType` or `schema` |
| Dependencies | Constructor injection | `currentServices()` inside `provide` |
| Denied caller | 403 from `IsUserAuthorized: false` | 403 from `undefined` |
| Cookie on the server | Read first when present | Never read |
| Modify details | `IIdentityProvider.ModifyDetails` | Not available |

## Related

- [How identity details are served](provider-flow.md)
- [Show identity in a React frontend](frontend.md)
- [Identity details schema](../introspection/identity-details-schema.md)
