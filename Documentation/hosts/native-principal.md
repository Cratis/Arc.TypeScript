---
title: Native principal
description: Pass a principal your web framework already verified into Arc through a trusted adapter callback, instead of running Arc authentication handlers.
---

Your Express session middleware, Fastify JWT plugin, or Hono auth middleware already knows who the caller is. By default Arc ignores that and runs its own [authentication handlers](../core/authentication.md). When you want Arc to use the host's verified user instead, switch on the native principal mode and hand the principal over explicitly.

## Turn it on

Set `nativePrincipal: true` in the options, and pass a callback as the second argument to `cratisArc`. The callback runs for every Arc request and returns a `NativeRequestContext`:

```typescript title="server.ts"
import express from 'express';
import { ArcApplication, type Principal } from '@cratis/arc.core';
import { cratisArc } from '@cratis/arc.express';

// Your own session middleware sets request.user after verifying the session.
type SessionRequest = express.Request & { user?: { id: string; roles: string[] } };

const builder = ArcApplication.createBuilder({ nativePrincipal: true });
await builder.discover(new URL('./Features/', import.meta.url));
const arc = await builder.build();

const app = express();
// app.use(yourVerifiedSessionMiddleware);
app.use(cratisArc(arc, request => {
    const user = (request as SessionRequest).user;
    const principal: Principal | undefined = user ? { ...user, isAuthenticated: true } : undefined;
    return { principal };
}));
```

The session middleware in this example is yours. Arc does not implement or validate session cookies: host sessions can use `HttpOnly`, `Secure`, and `SameSite` cookies according to your framework's own middleware.

## The native context

| Property | Meaning |
| --- | --- |
| `principal` | The host-verified caller; used only when `nativePrincipal` is on |
| `secure` | Whether the connection is TLS; Express and Fastify take it from the Node TLS socket unless you override it |
| `authority` | A host name known from trusted configuration, not the request `Host` header; used by the `subdomain` tenant source |
| `remoteAddress` | The caller's address, for anonymous per-caller observable limits |

The callback can be `async`. Adapters invoke it inside Arc's error boundary, so a thrown error becomes a redacted 500 with a correlation ID and a logger call.

:::danger[Only return verified values]
Never build native context from browser-supplied properties, cookies, `X-Forwarded-*` headers, or the request URL. The `.cratis-identity` display cookie cannot authenticate a caller.
:::

## Rules

- `nativePrincipal: true` cannot be combined with Arc authentication handlers; the server refuses to start with both.
- For an operation that requires a [named scheme](../core/authorization.md#select-an-authentication-scheme), the callback must supply a principal carrying that `scheme`.
- WebSocket upgrades take their own callback; see [WebSockets](websockets.md).
- The standalone Node host takes the same callback as its `native` option; see [Arc.Core](../core/index.md#security-defaults).
- `server.handle(request, native)` accepts the same context, or an async callback returning it, for Fetch API hosts. This is a privileged, server-side seam.

## Related

- [Authentication](../core/authentication.md)
- [Host adapters](index.md)
