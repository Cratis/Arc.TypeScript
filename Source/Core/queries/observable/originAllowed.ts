// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServerOptions } from '../../ArcServerOptions.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';

/** Check a browser Origin against trusted host metadata, never against forwarded headers by default. */
export async function originAllowed(origin: string | null, request: Request,
    native: NativeRequestContext | undefined, options: ArcServerOptions): Promise<boolean> {
    if (!origin) return true;
    try {
        const parsed = new URL(origin);
        if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) return false;
    } catch { return false; }
    const policy = options.allowedOrigins;
    if (Array.isArray(policy)) return policy.includes(origin);
    if (typeof policy === 'function') return policy(origin, request, native);
    const authority = native?.authority ?? request.headers.get('host');
    if (!authority) return false;
    return origin === `${native?.secure === true ? 'https' : 'http'}://${authority}`;
}
