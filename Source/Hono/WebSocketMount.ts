// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Server as HttpServer } from 'node:http';
import { createNodeWebSocket } from '@hono/node-ws';
import type { Context, Env, Hono } from 'hono';
import { ObservableHandshakeTimeoutError, prepareObservableUpgrade, serveUpgradedSocket,
    withObservableHandshakeTimeout } from '@cratis/arc.core';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.core';

/** Register Hono WebSocket routes before serve(), then inject into the Node listener. */
export function mountHonoWebSockets<E extends Env>(app: Hono<E>, server: ArcServer,
    native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>): {
        injectWebSocket(host: HttpServer): void;
        dispose(): Promise<void>;
    } {
    const helper = createNodeWebSocket({ app: app as unknown as Hono });
    helper.wss.options.maxPayload = server.observableLimits.inboundFrameBytes;
    const sockets = new Set<{ close(): void; completion: Promise<void> }>();
    const listeners = new Map<HttpServer, readonly ((...arguments_: unknown[]) => void)[]>();
    const routes = [...server.routes].filter(([, operation]) => 'observable' in operation && operation.observable === true)
        .map(([path]) => path);
    routes.push('/.cratis/queries/ws');
    for (const path of routes) {
        app.get(path, async (context, next) => {
            const raw = (context.env as { incoming?: { url?: string; socket?: { remoteAddress?: string } } } | undefined)?.incoming;
            if (raw?.url?.split('?')[0] !== path) return new Response(null, { status: 404 });
            const url = new URL(raw.url, 'http://arc.invalid');
            if (url.origin !== 'http://arc.invalid' || url.pathname !== path) return new Response(null, { status: 400 });
            let handshake;
            try {
                handshake = await withObservableHandshakeTimeout(async () => {
                    const supplied = await native?.(context);
                    const trusted: NativeRequestContext = { ...supplied,
                        remoteAddress: supplied?.remoteAddress ?? raw.socket?.remoteAddress };
                    const request = new Request(url, { headers: context.req.raw.headers });
                    const prepared = await prepareObservableUpgrade(server, request, trusted);
                    return { trusted, request, prepared };
                }, server.observableLimits.handshakeTimeoutMs);
            } catch (error) {
                if (error instanceof ObservableHandshakeTimeoutError) return new Response(null, { status: 408 });
                await server.options.logger?.(error, context.req.header(server.options.correlationHeader ?? 'X-Correlation-ID') ?? '');
                return new Response(null, { status: 500 });
            }
            if (handshake.prepared.status !== 101 || !handshake.prepared.resolved)
                return new Response(null, { status: handshake.prepared.status });
            return helper.upgradeWebSocket(() => ({
                onOpen: (_event, connection) => {
                    if (!connection.raw) { connection.close(1008, 'Missing host socket'); return; }
                    const bridge = serveUpgradedSocket(server, connection.raw, handshake.request,
                        handshake.trusted, handshake.prepared.resolved);
                    sockets.add(bridge);
                    const release = (): void => { sockets.delete(bridge); bridge.close(); };
                    void bridge.completion.then(release, release);
                }
            }))(context, next);
        });
    }
    return {
        injectWebSocket(host) {
            if (listeners.has(host)) throw new Error('Hono observable WebSockets are already injected');
            const before = new Set(host.listeners('upgrade'));
            helper.injectWebSocket(host);
            listeners.set(host, host.listeners('upgrade').filter(listener => !before.has(listener))
                .map(listener => listener as (...arguments_: unknown[]) => void));
        },
        async dispose() {
            for (const [host, owned] of listeners) {
                for (const listener of owned) host.off('upgrade', listener);
            }
            listeners.clear();
            const active = [...sockets];
            for (const socket of active) socket.close();
            const outcomes = await Promise.allSettled(active.map(socket => socket.completion));
            const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
            if (failures.length) throw new AggregateError(failures, 'Hono observable WebSocket cleanup failed');
        }
    };
}
