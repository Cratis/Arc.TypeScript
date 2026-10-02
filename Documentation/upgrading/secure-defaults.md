---
title: Migrating to secure discovery defaults
description: Restore access for discovery clients after the change to authenticated discovery outside Development, or explicitly keep anonymous discovery.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

## Who is affected

Applications and tools that anonymously read a deployed host's command/query catalogs,
identity schema, user/tenant discovery, or `/openapi.json`. These endpoints no longer
expose descriptions anonymously outside Development by default. This is a breaking
change; command/query invocation and `/.cratis/me` are unchanged.

## What changed

In Development, discovery stays anonymous. Everywhere else, configured Arc authentication
handlers or a host-verified native principal must authenticate the caller. Anonymous requests
receive 401. A host with no authentication leaves the discovery endpoints unmapped (normally
404) and logs one startup warning. Explicitly requiring authentication without configuring it
fails startup instead.

Development means the code-only option `environmentName: 'Development'` (case-insensitive),
which overrides the environment variables, or, when absent, the first defined value of
`DOTNET_ENVIRONMENT`, `ASPNETCORE_ENVIRONMENT`, and `NODE_ENV`. There is no
`Cratis:Arc:EnvironmentName` configuration key.
No environment means non-Development. The Node builder honors `configuration.env`; fetch
runtimes without `process` can set `environmentName` explicitly. `development: true` only
enables fixture providers and does not bypass this policy. The discovery-only `environmentName`
override does not change exception exposure: `exposeExceptionDetails` still defaults from
the host environment, including a supplied Node `configuration.env`, and can be set explicitly.

## Restore access

Prefer authenticating deployed tools using your existing handlers. Run a local build-time
HTTP description consumer against a Development host. Source-based proxy generation needs
no running HTTP host and is unchanged.

If deployed tools do not need catalogs or HTTP OpenAPI, an alternative is to set `Cratis__Arc__Introspection__Enabled=false` in the deployment, or `Cratis:Arc:Introspection:Enabled` to `false` in `appsettings.Production.json`. The catalogs and `/openapi.json` then stay unmapped even with authentication configured. Local discovery can stay enabled. Identity discovery keeps its access policy and startup authentication diagnostics; in-process `openApi()` and `exportClientManifest` are unaffected. See [Turn discovery off](../introspection/index.md#turn-discovery-off).

If you deliberately want the old anonymous behavior, set the option in the Node builder
(or pass the same option to `ArcServer` or the fetch builder):

```typescript
import { ArcApplication } from '@cratis/arc.core';

const builder = ArcApplication.createBuilder({
    introspection: { requireAuthentication: false }
});
```

For Node configuration, use `Cratis__Arc__Introspection__RequireAuthentication=false`, or:

```json
{
  "Cratis": {
    "Arc": {
      "Introspection": { "RequireAuthentication": false }
    }
  }
}
```

An anonymous opt-out outside Development logs a warning. To narrow authenticated discovery
to operators, use `introspection: { roles: 'Admin,Operator' }` or
`Cratis__Arc__Introspection__Roles=Admin,Operator`. Any listed role grants access; roles
imply authentication even in Development. Empty roles and roles combined with an anonymous
opt-out are startup errors.

See [Introspection](../introspection/index.md#production-access) for the complete endpoint
list, configuration precedence, and differences from .NET hosting.
