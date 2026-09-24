// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Context, Env, Hono } from 'hono';
export { mountHonoWebSockets } from './WebSocketMount.js';
import { ArcApplication, type ArcServer, type NativeRequestContext } from '@cratis/arc.core';

/** No TLS or principal is inferred from Fetch URLs/headers. Explicit callback must attest both. */
export function mountHono<E extends Env>(app: Hono<E>, application: ArcServer | ArcApplication,
    native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>): void {
    const server = application instanceof ArcApplication ? application.server : application;
    app.use('*', async (context, next) => {
        if (context.req.header('upgrade')?.toLowerCase() === 'websocket') return next();
        // The Node adapter exposes the unnormalized request-target through env.incoming.
        // A Fetch Request alone has already lost that spelling: never use its Host or URL as authority.
        const incoming: unknown = (context.env as {
            incoming?: { url?: string; socket?: { remoteAddress?: string } }
        } | undefined)?.incoming;
        const raw = incoming && typeof incoming === 'object' && 'url' in incoming ? incoming.url : undefined;
        if (typeof raw === 'string') {
            const path = raw.split('?')[0] ?? '';
            if (!server.endpoints.has(path)) return next();
            let url: URL;
            try { url = new URL(raw, 'http://arc.invalid'); } catch { return next(); }
            if (url.origin !== 'http://arc.invalid' || url.pathname !== path) return next();
        }
        // Keep authority out of the Fetch URL; transport identity arrives separately.
        const source = new URL(context.req.raw.url);
        const target = new URL(`${source.pathname}${source.search}`, 'http://arc.invalid');
        if (!server.endpoints.has(target.pathname)) return next();
        const result = await server.handle(new Request(target, context.req.raw), async () => {
            const verified = await native?.(context);
            const peer = incoming && typeof incoming === 'object' && 'socket' in incoming &&
                incoming.socket && typeof incoming.socket === 'object' && 'remoteAddress' in incoming.socket
                ? incoming.socket.remoteAddress as string | undefined : undefined;
            return { ...verified, remoteAddress: verified?.remoteAddress ?? peer };
        });
        if (!result) return next();
        // Hono does not merge cookies set by earlier middleware into a returned Response.
        const existing = context.res.headers.getSetCookie();
        const headers = new Headers(result.headers);
        for (const cookie of existing) headers.append('set-cookie', cookie);
        // Hono merges upstream headers after this middleware returns. Preserve cookies,
        // but never let an upstream cache policy or correlation override Arc's result.
        context.res.headers.delete('set-cookie');
        context.res.headers.delete('cache-control');
        context.res.headers.delete(server.options.correlationHeader ?? 'X-Correlation-ID');
        return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
    });
}
