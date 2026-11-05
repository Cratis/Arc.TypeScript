// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useEffect, useState } from 'react';

interface Me { isAuthenticated: boolean; name?: string; roles?: string[]; details?: { displayName: string; tenant: string; isAdmin: boolean } }

/** What `/.cratis/me` knows about the caller, including the details from the identity details provider. */
export function IdentityBadge() {
    const [me, setMe] = useState<Me>();
    useEffect(() => {
        void fetch('/.cratis/me', { credentials: 'same-origin' }).then(async response => setMe(response.ok ? await response.json() as Me : { isAuthenticated: false }));
    }, []);
    if (!me?.isAuthenticated) return <p>Anonymous (<code>/.cratis/me</code> answered 401)</p>;
    return <p><b>{me.details?.displayName ?? me.name}</b> · roles {me.roles?.join(', ') || 'none'} · tenant {me.details?.tenant}</p>;
}
