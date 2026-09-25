---
title: Simulate a signed-in user locally
description: Exercise different users, roles, and tenant memberships on a loopback development host with forwarded Microsoft identity headers, without mistaking Base64 assertions for verified tokens.
---

You want to see how the application behaves for an editor, for a reader, and for someone who belongs to another tenant, before production sign-in exists. This guide turns on Arc's Microsoft identity header handler on your development machine only, and sends it synthetic principals.

This is identity **simulation**. Nothing here verifies a token.

## Understand the trust boundary first

`microsoftIdentityPlatform()` reads the `x-ms-client-principal`, `x-ms-client-principal-id`, and `x-ms-client-principal-name` headers that Azure EasyAuth or a trusted ingress forwards. The principal header is Base64-encoded JSON. It has no signature, so anyone who can reach the server can claim to be anyone.

Enable the handler only on a host bound to `127.0.0.1`, and only when you run it locally. In production, either verify real tokens with [`jwtBearer()`](../core/authentication.md#verify-jwt-bearer-tokens), or accept these headers only behind an ingress that strips caller-supplied identity headers and blocks direct access to the backend.

## Steps

1. Register the handler only for local development. The standalone host binds `127.0.0.1` unless you pass another `host`:

    ```typescript title="main.ts"
    import { ArcApplication, microsoftIdentityPlatform } from '@cratis/arc.core';

    const development = process.env.NODE_ENV === 'development';

    const builder = ArcApplication.createBuilder({
        development,
        authentication: development ? [microsoftIdentityPlatform()] : [],
        tenancy: { sources: ['header'], membershipClaim: 'tenants' }
    });
    await builder.discover(new URL('./Features/', import.meta.url));
    const app = await builder.build();
    await app.run({ port: 3000 });
    ```

    `membershipClaim: 'tenants'` makes Arc check the selected tenant against the principal's `tenants` claim, so you can test membership too. This guide assumes a command `ArchiveTask` in `Features/Tasks/` decorated with `@roles('Editor')`.

2. Save a synthetic principal as `principal.json`. Use invented values, never a real user's:

    ```json title="principal.json"
    {
      "identityProvider": "development",
      "userId": "ada",
      "userDetails": "Ada",
      "userRoles": ["Editor"],
      "claims": [{ "typ": "tenants", "val": "acme" }]
    }
    ```

    `userRoles` become the principal's roles. Each claim becomes an own claim on the principal, so `tenants` is what `membershipClaim` reads. `userDetails` becomes the principal's `name`.

3. Encode it on one line, locally. Do not paste identity payloads into an online encoder:

    ```bash
    PRINCIPAL=$(python3 -c 'import base64,pathlib; print(base64.b64encode(pathlib.Path("principal.json").read_bytes()).decode())')
    ```

4. Start the host with `NODE_ENV=development`, then send the three headers with a request:

    ```bash
    curl -X POST http://127.0.0.1:3000/api/tasks/archive-task \
      -H 'content-type: application/json' \
      -H 'x-cratis-tenant-id: acme' \
      -H "x-ms-client-principal: $PRINCIPAL" \
      -H 'x-ms-client-principal-id: ada' \
      -H 'x-ms-client-principal-name: Ada' \
      -d '{"id":"t1"}'
    ```

    The command succeeds with `"isSuccess":true` and HTTP 200.

## Check each behavior

Change one thing at a time and compare the status:

| Request | Status | Why |
| --- | --- | --- |
| No identity headers | 401 | `ArchiveTask` requires a role and nobody is authenticated |
| A principal header that is not valid Base64 JSON | 401 | The handler rejected the credential |
| Ada, tenant `acme` | 200 | Ada has `Editor` and belongs to `acme` |
| Ada, tenant `globex` | 403 | `globex` is not in Ada's `tenants` claim |
| A principal without `Editor`, tenant `acme` | 403 | The role check failed |

With an [identity details provider](provider-flow.md), `GET /.cratis/me` with the same headers returns Ada's identity and sets the display cookie.

## Offer the users to a picker

Tools that switch users for you, such as [Lens](/tools/lens/), read `/.cratis/users` and `/.cratis/tenants`. Their user entries use the same shape as `principal.json`, so one fixture serves both:

```typescript
const builder = ArcApplication.createBuilder({
    development,
    authentication: development ? [microsoftIdentityPlatform()] : [],
    tenancy: { sources: ['header'], membershipClaim: 'tenants' },
    developmentUsers: () => [{
        microsoftIdentity: {
            identityProvider: 'development', userId: 'ada', userDetails: 'Ada',
            userRoles: ['Editor'], claims: [{ typ: 'tenants', val: 'acme' }]
        }
    }],
    developmentTenants: () => [{ id: 'acme', name: 'Acme' }]
});
```

A picker only lists these entries. Arc honors the identity headers a tool then sends because `microsoftIdentityPlatform()` is registered, and for no other reason. See [Development users and tenants](development-users-and-tenants.md) for the limits of these routes.

:::caution[Use a narrow scope in browser header tools]
If you add the headers with a browser extension instead of curl, restrict it to your local URLs, such as `http://127.0.0.1:5173/*`. A rule that applies to every site sends your synthetic identity everywhere you browse.
:::

## Clean up

Remove the synthetic headers from any browser tool when you finish, and keep the `development` condition around `microsoftIdentityPlatform()`. These checks prove your roles, tenancy, and authorization configuration. They do not test production token verification or your ingress.
