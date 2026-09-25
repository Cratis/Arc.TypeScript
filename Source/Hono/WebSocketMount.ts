// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Socket } from 'node:net';
import { createNodeWebSocket } from '@hono/node-ws';
import type { NodeWebSocket } from '@hono/node-ws';
import type { Context, Env, Hono, Next } from 'hono';
import { ObservableHandshakeTimeoutError, prepareObservableUpgrade, serveUpgradedSocket,
    withObservableHandshakeTimeout, observableLimits } from '@cratis/arc.core/hosting';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.core';

type SocketBridge = { close(): void; completion: Promise<void> };

type UpgradeHelper = ReturnType<typeof createNodeWebSocket>;

async function prepareHandshake<E extends Env>(context: Context<E>, server: ArcServer, path: string,
    native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>) {
    const raw = (context.env as { incoming?: {
        url?: string; socket?: { remoteAddress?: string; encrypted?: boolean }
    } } | undefined)?.incoming;
    if (raw?.url?.split('?')[0] !== path) return { status: 404 };
    const url = new URL(raw.url, 'http://arc.invalid');
    if (url.origin !== 'http://arc.invalid' || url.pathname !== path) return { status: 400 };
    try {
        return await withObservableHandshakeTimeout(async () => {
            const supplied = await native?.(context);
            const trusted: NativeRequestContext = { ...supplied,
                remoteAddress: supplied?.remoteAddress ?? raw.socket?.remoteAddress,
                secure: supplied?.secure ?? raw.socket?.encrypted === true };
            const request = new Request(url, { headers: context.req.raw.headers });
            const prepared = await prepareObservableUpgrade(server, request, trusted);
            return { trusted, request, prepared };
        }, observableLimits(server).handshakeTimeoutMs);
    } catch (error) {
        if (error instanceof ObservableHandshakeTimeoutError) return { status: 408 };
        const header = server.options.correlationId?.httpHeader ?? 'X-Correlation-ID';
        await server.options.logger?.(error, context.req.header(header) ?? '');
        return { status: 500 };
    }
}

async function handleUpgrade<E extends Env>(context: Context<E>, next: Next, server: ArcServer, path: string, helper: UpgradeHelper,
    sockets: Set<SocketBridge>, native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>) {
    if (context.req.header('upgrade')?.toLowerCase() !== 'websocket') return next();
    const handshake = await prepareHandshake(context, server, path, native);
    if ('status' in handshake) return new Response(null, { status: handshake.status });
    if (handshake.prepared.status !== 101 || !handshake.prepared.resolved)
        return new Response(null, { status: handshake.prepared.status });
    const resolved = handshake.prepared.resolved;
    return helper.upgradeWebSocket(() => ({
        onOpen: (_event, connection) => {
            if (!connection.raw) { connection.close(1008, 'Missing host socket'); return; }
            const bridge = serveUpgradedSocket(server, connection.raw, handshake.request,
                handshake.trusted, resolved);
            sockets.add(bridge);
            const release = (): void => { sockets.delete(bridge); bridge.close(); };
            void bridge.completion.then(release, release);
        }
    }))(context, next);
}

/** Register Hono WebSocket routes before serve(), then inject into the Node listener. */
export function createHonoWebSockets<E extends Env>(app: Hono<E>, server: ArcServer,
    native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>,
    existingWebSockets?: NodeWebSocket): {
        injectWebSocket(host: HttpServer): void;
        dispose(): Promise<void>;
    } {
    const helper = existingWebSockets ?? createNodeWebSocket({ app: app as unknown as Hono });
    if (!existingWebSockets) helper.wss.options.maxPayload = observableLimits(server).inboundFrameBytes;
    const sockets = new Set<SocketBridge>();
    const listeners = new Map<HttpServer, readonly ((...arguments_: unknown[]) => void)[]>();
    const routes = [...server.routes].filter(([, operation]) => 'observable' in operation && operation.observable === true)
        .map(([path]) => path);
    routes.push('/.cratis/queries/ws');
    for (const path of routes) app.get(path, (context, next) => handleUpgrade(context, next, server, path, helper, sockets, native));
    return {
        injectWebSocket(host) {
            if (listeners.has(host)) throw new Error('Hono observable WebSockets are already injected');
            const before = new Set(host.listeners('upgrade'));
            if (!existingWebSockets) helper.injectWebSocket(host);
            host.prependListener('upgrade', (request: IncomingMessage, socket: Socket) => {
                if (!server.endpoints.has(request.url?.split('?')[0] ?? '')) return;
                const onSocketError = (): void => { socket.destroy(); };
                socket.on('error', onSocketError);
                socket.once('close', () => socket.off('error', onSocketError));
            });
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
