---
title: Tenant resolvers
description: Select a tenant from a header, query string, trusted claim, fixed value, or verified subdomain, in the order you choose, with optional required and membership checks.
---

Where does the tenant come from: a header your gateway sets, a claim in the user's token, or the `acme` in `acme.example.com`? Pick the source, or an ordered list of sources, that matches how your callers arrive.

Set `tenancy.resolverType` for one .NET-compatible source, or `tenancy.sources` for an ordered list. The first nonempty result wins. Do not set both. A header or query-string value is a **selection**, not proof of authority.

## Sources

| Source | Configuration | Reads |
| --- | --- | --- |
| `header` | `tenancy.httpHeader` (default `x-cratis-tenant-id`) | Request header |
| `query` | `queryParameter` (default `tenantId`) | Request query string |
| `claim` | `claimType` (default `tenant_id`) | An own string claim on an authenticated principal |
| `fixed` | `fixedTenantId` (default `development`) | A configured deployment value |
| `development` | `fixedTenantId` (default `development`) | The same fixed source as in .NET; it does **not** check your environment |
| `subdomain` | Required `baseDomain` | The verified adapter `native.authority`, **not** the raw `Host` or `X-Forwarded-Host` header |

Import `TenantResolverType` from `@cratis/arc.core`. For a single-tenant application, `resolverType: TenantResolverType.Fixed, fixedTenantId: 'default'` gives every request the `default` tenant.

## Options

| Option | Effect |
| --- | --- |
| `resolverType` / `sources` | One source (defaults to `header` when `tenancy` is supplied) / an ordered list; they cannot be combined |
| `required` | An unresolved tenant answers 400 |
| `membershipClaim` | A selected tenant requires an authenticated principal whose own claim of this name, a comma-separated list, includes it; otherwise 403 |
| `queryParameter`, `claimType`, `fixedTenantId`, `baseDomain` | Per-source settings |

## Validation rules

- Nonempty IDs are lowercased and must be DNS labels: letters, digits, and hyphens, at most 63 characters. An invalid selected ID answers 400.
- A nonstring selected tenant claim answers 400; a nonstring membership claim answers 403. Strategies read only own string values from the claim object.
- `subdomain` requires an ASCII `baseDomain` of at least two labels and a host-verified `authority` from the adapter callback. Only a single subdomain label matches; IP addresses, unrelated or multi-label hosts, and raw `Host` or forwarded headers never do.
- The header is the default source when `tenancy` is supplied; no development or fixed strategy is installed implicitly. Write `sources: [TenantResolverType.Subdomain, TenantResolverType.Header]` to fall back explicitly.
- Other strategy errors and unsafe startup options fail closed.

Never use `development` or `fixed` to accept a browser-supplied tenant without validating access. `tenancy.resolve` overrides these sources, and the legacy header behavior applies when `tenancy` is absent; see [Tenancy](index.md).

## Related

- [Storage isolation](isolation.md) for where the resolved tenant sends data
- [Native principal](../hosts/native-principal.md) for supplying a verified authority
- [Authentication](../core/authentication.md)
