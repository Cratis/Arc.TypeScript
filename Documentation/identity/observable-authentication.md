---
title: Authenticate observable query transports
description: Authenticate WebSocket and SSE connections with default handlers or verified host sessions, and understand why observable queries cannot select named schemes.
---

<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

An observable connection needs credentials on its opening HTTP request, not inside a subscription message. The [Entra bearer](entra-bearer.md) and [AuthProxy/EasyAuth](authproxy-easyauth.md) recipes register **default** authentication handlers, which Arc uses for observable connections as well as ordinary HTTP requests.

## Do not select a named scheme on an observable query

An observable query with `@authorize({ schemes: ['Entra'] })`, or the equivalent low-level `authorization.schemes`, is rejected during route-table construction. This applies even if you intended to use only its direct route. The multiplexed hub does not authenticate each subscription separately and cannot select different credentials for different queries on one connection.

Instead, register the handler in `authentication: [handler]`, or use `nativePrincipal: true` with a host callback that has actually authenticated the request. These modes are mutually exclusive. Keep **roles and named policies** on the observable queries: each subscription still runs query authorization against the connection's principal. A named policy is an authorization rule, not an authentication scheme.

## Put credentials where the transport can carry them

| Transport | Supported authentication path |
| --- | --- |
| Native WebSocket client | Send `Authorization: Bearer <API-access-token>` on the HTTP upgrade request; a default `jwtBearer()` handler verifies it |
| Browser WebSocket | The browser cannot set an arbitrary Authorization header. Use a real session cookie verified by a default application handler, a trusted native-principal callback, or an authentication proxy that forwards the verified identity on the upgrade |
| Browser `EventSource` | Uses same-origin cookies, not custom Authorization headers. Use the same verified session/proxy boundary for the stream **and** control POSTs |
| Fetch-based or native SSE client | Can send a Bearer header on the stream request and every control POST; use the default bearer handler |
| Direct observable HTTP route | Its snapshot, long-poll and SSE requests use the normal HTTP authentication path; credentials are required on each request |

Arc does not supply a general-purpose login/session-cookie verifier. Your application's handler must verify the actual session before returning a principal. The unsigned `.cratis-identity` **display cookie never qualifies**. Cross-origin cookies also require deliberate browser credential, SameSite, CORS and CSRF configuration; prefer a same-origin boundary when possible.

Do not put access tokens in query strings, query arguments, hub frames or WebSocket subprotocol names. Arc does not treat those fields as bearer credentials, and URLs commonly reach logs and browser history. Changing a generated client's HTTP headers does not give a browser WebSocket or `EventSource` constructor a header API it does not have.

## Protect both the opening request and the controls

- WebSocket hub: `/.cratis/queries/ws`. Default authentication runs on the upgrade. Invalid credentials reject the upgrade; an anonymous connection can still be admitted, but cannot subscribe to a protected query.
- SSE hub: `GET /.cratis/queries/sse`, with `POST /.cratis/queries/sse/subscribe` and `/unsubscribe`. The stream captures the caller; every control request authenticates again and must match the connection's tenant, authentication state and principal ID. A connection ID is not a credential. Unknown or unowned connections return 404.
- Direct query routes: ordinary HTTP requests authenticate normally; WebSocket upgrades use the same default connection-authentication path as the hub. Query authorization still decides whether the requested query may execute.

The standalone Node host handles upgrades. **Express HTTP middleware does not run on Node upgrades**: attach Arc's WebSocket listener and authenticate using an Arc handler or a verified upgrade callback, not a session value you assume Express already populated. Fastify hooks and Hono middleware have different upgrade behavior; follow the [host-specific WebSocket guidance](../hosts/websockets.md).

Use HTTPS/WSS. Keep exact allowed Origins configured for browser connections; absent Origin is allowed for native clients and is not proof of identity. A proxy must forward upgrades, strip caller-supplied identity headers **before** authenticating, and block direct backend access just as for ordinary HTTP. Origin checks do not replace authentication, header sanitization, or CSRF defenses.

## Account for long-lived identity

Authentication captures a principal when the connection opens. A new token sent on a later SSE control request proves ownership; it does not replace the connection's captured principal or update its roles. Reconnect after sign-in, sign-out, token renewal or permission changes.

`jwtBearer()` checks expiry when it authenticates the request. It does **not** schedule the live connection to close at token expiry, continuously refresh tokens, or detect provider revocation. For sensitive streams, implement an [observable emission guard](../queries/observable-query-emission-guards.md) that checks current permission/session validity and denies further delivery, and define a server-enforced connection lifetime. A client-only reconnect timer is not a revocation control.

These boundaries are implemented by `createRouteTable`, `prepareObservableUpgrade`, `resolveConnectionContext`, `ObservableQueryHub` and `ObservableQuerySession` in Arc.Core. They are not properties of a particular identity provider.

## Related

- [Multiplexed observable queries](../queries/observable-query-demultiplexer.md) for hub framing, controls and limits
- [WebSockets](../hosts/websockets.md) for mounting upgrades and Origin configuration
- [Authorization policies and schemes](../core/authorization.md#select-an-authentication-scheme)
