---
title: Show identity in a React frontend
description: Read the signed-in user and typed identity details with @cratis/arc.react, hide UI by role while the identity loads, and refresh or clear the cached identity.
---

Your backend now answers `/.cratis/me`. On the React side you want three things: the user's name in the header, controls hidden from people who cannot use them, and a way to pick up changes without a full reload. The published `@cratis/arc.react` client already does the fetching and caching. You connect it to the details class your backend declares.

This page uses `@cratis/arc` and `@cratis/arc.react` 22.19.1, the client versions the [proxy generator](../proxy-generation/getting-started.md) targets.

## Give the client your details type

Generate proxies from the backend that holds your identity provider. The generator emits the provider's `detailsType` as a frontend class with the same `@field` declarations:

```typescript title="src/generated/Identity/UserDetails.proxy.ts (generated excerpt)"
import { field } from '@cratis/fundamentals';

export class UserDetails {
    @field(String)
    greeting!: string;
}
```

Pass it to the `Arc` component at the root of your application:

```tsx title="src/App.tsx"
import { Arc } from '@cratis/arc.react';
import { UserDetails } from './generated/Identity/UserDetails.proxy';
import { Header } from './Header';

export function App() {
    return <Arc detailsType={UserDetails}>
        <Header />
    </Arc>;
}
```

`Arc` already contains an identity provider. On mount it reads the `.cratis-identity` cookie. When the cookie is missing, it calls `/.cratis/me` with the same `httpHeadersCallback` headers your commands and queries send, and the response sets the cookie for next time.

## Read the identity

```tsx title="src/Header.tsx"
import { useIdentity } from '@cratis/arc.react/identity';
import { UserDetails } from './generated/Identity/UserDetails.proxy';

export function Header() {
    const identity = useIdentity(UserDetails);
    if (identity.isLoading) return <p>Loading…</p>;
    if (!identity.isSet) return <p>Please sign in.</p>;
    return <p>{identity.details.greeting}</p>;
}
```

`useIdentity(UserDetails)` returns the identity with `details` typed as `UserDetails`, plus `id`, `name`, `roles`, and `isInRole(role)`. Check `isLoading` first: before the first answer arrives, `isSet` is `false` for a signed-in user too. After loading, `isSet` is `false` when `/.cratis/me` answered anything other than 200, such as 401 for an anonymous caller or 403 from a provider that returned `undefined`.

## Hide controls by role

`RequireRole` renders its children only for a signed-in caller with one of the roles, and keeps the loading and denied states apart:

```tsx title="src/ArchiveButton.tsx"
import { RequireRole } from '@cratis/arc.react/identity';

export function ArchiveButton() {
    return <RequireRole roles={['Editor']} whileLoading={<p>Loading…</p>} forbidden={<p>Read-only</p>}>
        <button>Archive</button>
    </RequireRole>;
}
```

The roles come from the verified principal on the server, so they match what `@roles('Editor')` checks. The check in the browser still only hides UI. Anyone can edit the cookie and render the button; the command behind it answers 403 because the server authorizes against the real principal. Protect every command and query on the server, as described in [Authorization policies and schemes](../core/authorization.md).

## Refresh after a change

The client keeps using the cookie until something replaces it. After an action that changes what `/.cratis/me` would return, such as a role grant, a profile edit, or a switch to another tenant, call `refresh()`:

```tsx
import { useIdentity } from '@cratis/arc.react/identity';
import { UserDetails } from './generated/Identity/UserDetails.proxy';

export function SwitchTenant({ tenant }: { tenant: string }) {
    const identity = useIdentity(UserDetails);
    const select = async () => {
        localStorage.setItem('tenant', tenant);
        await identity.refresh();
    };
    return <button onClick={() => void select()}>Switch to {tenant}</button>;
}
```

This example assumes the application's `httpHeadersCallback` reads the tenant from `localStorage` and sends it as the `x-cratis-tenant-id` header. `refresh()` clears the cookie, calls `/.cratis/me`, and re-renders every component that uses the identity. While it runs, `isLoading` is `true` again. When `/.cratis/me` answers with an error status, the identity becomes unset. When the request itself fails, for example on a network error, the promise rejects and the previous identity stays in place.

When a user signs out, call `clearIdentity()` from `useIdentity()`. It removes the cookie and resets the identity to unset without calling the server.

## Common mistakes

- **Treating `isSet: false` as signed out during loading.** Show a loading state until `isLoading` is `false`, or signed-in users see the signed-out UI flash on every page load.
- **Using only a type argument.** `useIdentity<UserDetails>()` types the details but cannot deserialize them, because a type has no runtime field metadata. Pass the generated class, `useIdentity(UserDetails)`, so concepts, dates, and nested models arrive as their real types.
- **Expecting the UI to notice server-side changes.** Nothing pushes identity changes to the browser. Call `refresh()` after the change, or after a fresh sign-in.

## Recap

- `Arc detailsType={...}` plus `useIdentity(Type)` gives every component typed details from one cached request.
- `RequireRole` hides UI and never replaces server authorization.
- `refresh()` re-reads `/.cratis/me` after a change; `clearIdentity()` forgets the user on sign-out.

The shared [React identity](/arc/frontend/react/identity/) page covers the rest of the client API, including default details and the raw context. To see how services share one identity, read [Identity across services](topologies.md).
