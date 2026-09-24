---
title: Resolve tenants
description: Select a tenant from a trusted claim, configured id, request parameter, or verified host authority.
---

Arc resolves a tenant for each request; it does not establish whether the caller belongs to that tenant unless you configure a membership check. A header or query string is a **selection**, not proof of authority.

Set `tenancy: { sources: ['claim', 'header'], claimType: 'tenant', required: true }` on `ArcServer` to try a trusted authenticated claim first and a header second. Sources run in your order; the first nonempty result wins. A selected value must pass Arc's tenant-id validation. Use `membershipClaim: 'tenants'` to require the authenticated principal's own comma-delimited membership claim before using a selected tenant; a mismatch answers 403. `required: true` rejects an unresolved tenant with 400. Those checks do not replace storage-level isolation.

| Source | Configuration | Reads |
| --- | --- | --- |
| `header` | `tenantHeader` (default `x-cratis-tenant-id`) | Request header |
| `query` | `queryParameter` (default `tenantId`) | Request query string |
| `claim` | Required `claimType` | Own claim on an authenticated principal |
| `fixed` | Required `fixed` tenant id | Configured deployment value |
| `development` | Required `fixed` tenant id | Alias of `fixed`, as in .NET; it does **not** check your environment |
| `subdomain` | Required `baseDomain` | The verified adapter `native.authority`, **not** the raw Host or X-Forwarded-Host header |

Never use `development` or `fixed` to accept a browser-supplied tenant without validating access. `resolveTenant` overrides the configured resolver; the legacy header behavior remains when `tenancy` is absent. Local development user and tenant listing endpoints are separate from tenant resolution: `development: true` with `developmentUsers`/`developmentTenants` provider functions (or arrays of functions) aggregates their results on the anonymous `/.cratis/users` and `/.cratis/tenants` routes. Return fixtures only. Production discovery providers are refused at startup, but the endpoints themselves remain anonymous and return `[]` by default. See [identity](../identity/index.md) for principal verification.
