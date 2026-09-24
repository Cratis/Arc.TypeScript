---
title: Tenant resolvers
description: Select a tenant from a header, query string, trusted claim, fixed value, or verified subdomain, in the order you choose, with optional required and membership checks.
---

The `tenancy` option lists built-in tenant sources in the order Arc tries them. The first nonempty result wins. A header or query-string value is a **selection**, not proof of authority.

## Sources

| Source | Configuration | Reads |
| --- | --- | --- |
| `header` | `tenantHeader` (default `x-cratis-tenant-id`) | Request header |
| `query` | `queryParameter` (default `tenantId`) | Request query string |
| `claim` | Required `claimType` | An own string claim on an authenticated principal |
| `fixed` | Required `fixed` tenant ID | A configured deployment value |
| `development` | Required `fixed` tenant ID | Alias of `fixed`, as in .NET; it does **not** check your environment |
| `subdomain` | Required `baseDomain` | The verified adapter `native.authority`, **not** the raw `Host` or `X-Forwarded-Host` header |

For a single-tenant application, `sources: ['fixed'], fixed: 'default'` gives every request the `default` tenant.

## Options

| Option | Effect |
| --- | --- |
| `sources` | The ordered list above |
| `required` | An unresolved tenant answers 400 |
| `membershipClaim` | A selected tenant requires an authenticated principal whose own claim of this name, a comma-separated list, includes it; otherwise 403 |
| `queryParameter`, `claimType`, `fixed`, `baseDomain` | Per-source settings |

## Validation rules

- Nonempty IDs are lowercased and must be DNS labels: letters, digits, and hyphens, at most 63 characters. An invalid selected ID answers 400.
- A nonstring selected tenant claim answers 400; a nonstring membership claim answers 403. Strategies read only own string values from the claim object.
- `subdomain` requires an ASCII `baseDomain` of at least two labels and a host-verified `authority` from the adapter callback. Only a single subdomain label matches; IP addresses, unrelated or multi-label hosts, and raw `Host` or forwarded headers never do.
- No implicit fallback or development strategy is installed. Write `sources: ['subdomain', 'header']` to fall back to a header explicitly.
- Other strategy errors and unsafe startup options fail closed.

Never use `development` or `fixed` to accept a browser-supplied tenant without validating access. `resolveTenant` overrides this option, and the legacy header behavior applies when `tenancy` is absent; see [Tenancy](index.md).

## Related

- [Native principal](../hosts/native-principal.md) for supplying a verified authority
- [Authentication](../core/authentication.md)
