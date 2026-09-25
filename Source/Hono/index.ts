// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Hono } from 'hono';
import type { Context, Env, MiddlewareHandler } from 'hono';
import type { Server as HttpServer } from 'node:http';
import { mountHonoWebSockets } from './WebSocketMount.js';
export { mountHonoWebSockets } from './WebSocketMount.js';
export { serveCratisArc } from './serveCratisArc.js';
import type { ArcApplication, ArcServer, NativeRequestContext } from '@cratis/arc.core';

/** Create Arc middleware; for caller-owned Node listeners inject WebSockets separately. */
export function cratisArc<E extends Env>(application: ArcServer | ArcApplication,
    native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>): MiddlewareHandler<E> & {
        injectWebSocket(host: HttpServer): () => Promise<void>;
    } {
    const server = 'server' in application ? application.server : application;
    const middleware: MiddlewareHandler<E> = async (context, next) => {
        if (context.req.header('upgrade')?.toLowerCase() === 'websocket') return next();
        // A wildcard middleware mounted at /v1/* receives the full URL; strip only its declared base.
        const route = context.req.routePath;
        const prefix = route.endsWith('/*') ? route.slice(0, -2) : '';
        const source = new URL(context.req.raw.url);
        if (prefix && !source.pathname.startsWith(`${prefix}/`)) return next();
        const path = source.pathname.slice(prefix.length);
        if (!server.endpoints.has(path)) return next();
        // On Node, require an exact raw request-target. Never trust Host as authority.
        const incoming: unknown = (context.env as {
            incoming?: { url?: string; socket?: { remoteAddress?: string } }
        } | undefined)?.incoming;
        const raw = incoming && typeof incoming === 'object' && 'url' in incoming ? incoming.url : undefined;
        if (typeof raw === 'string') {
            if (raw.split('?')[0] !== source.pathname) return next();
            let url: URL;
            try { url = new URL(raw, 'http://arc.invalid'); } catch { return next(); }
            if (url.origin !== 'http://arc.invalid' || url.pathname !== source.pathname) return next();
        }
        const target = new URL(`${path}${source.search}`, 'http://arc.invalid');
        const result = await server.handle(new Request(target, context.req.raw), async () => {
            const verified = await native?.(context);
            const peer = incoming && typeof incoming === 'object' && 'socket' in incoming &&
                incoming.socket && typeof incoming.socket === 'object' && 'remoteAddress' in incoming.socket
                ? incoming.socket.remoteAddress as string | undefined : undefined;
            return { ...verified, remoteAddress: verified?.remoteAddress ?? peer };
        });
        if (!result) return next();
        const existing = context.res.headers.getSetCookie();
        const headers = new Headers(result.headers);
        for (const cookie of existing) headers.append('set-cookie', cookie);
        context.res.headers.delete('set-cookie');
        context.res.headers.delete('cache-control');
        context.res.headers.delete(server.options.correlationHeader ?? 'X-Correlation-ID');
        return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
    };
    const upgrades = new Hono<E>();
    const bridge = mountHonoWebSockets(upgrades, server, native);
    return Object.assign(middleware, {
        injectWebSocket(host: HttpServer): () => Promise<void> {
            bridge.injectWebSocket(host);
            return () => bridge.dispose();
        }
    });
}

/** @deprecated Use app.use(cratisArc(application)). */
export function mountHono<E extends Env>(app: Hono<E>, application: ArcServer | ArcApplication,
    native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>): void {
    app.use(cratisArc(application, native));
}
