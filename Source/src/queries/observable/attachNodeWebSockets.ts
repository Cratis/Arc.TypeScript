// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Socket } from 'node:net';
import { TLSSocket } from 'node:tls';
import { WebSocketServer } from 'ws';
import type { ArcServer } from '../../ArcServer.js';
import type { NativeRequestContext } from '../../NativeRequestContext.js';
import { isObservableOperation } from './ObservableOperation.js';
import { directWebSocket } from './directWebSocket.js';
import { WebSocketTransport } from './WebSocketTransport.js';

const bridges = new WeakMap<ArcServer, Map<HttpServer, () => Promise<void>>>();

/** Attach the Node upgrade bridge without replacing another application's upgrade handlers. */
export function attachNodeWebSockets(host: HttpServer, arc: ArcServer,
    native?: (request: IncomingMessage) => Omit<NativeRequestContext, 'secure'>): () => Promise<void> {
    const owned = bridges.get(arc) ?? new Map<HttpServer, () => Promise<void>>();
    if (owned.has(host)) throw new Error('Arc WebSocket bridge is already mounted on this server');
    const webSockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
    const connections = new Set<{ transport: WebSocketTransport; work: Promise<void> }>();
    const onUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer): void => {
        const raw = request.url ?? '';
        const path = raw.split('?')[0];
        if (!path || !arc.endpoints.has(path)) return;
        let url: URL;
        try { url = new URL(raw, 'http://arc.invalid'); }
        catch { socket.destroy(); return; }
        const operation = arc.routes.get(path);
        if (url.origin !== 'http://arc.invalid' || url.pathname !== path ||
            !operation || !isObservableOperation(operation)) return;
        const origin = request.headers.origin;
        const secure = request.socket instanceof TLSSocket && request.socket.encrypted === true;
        if (origin && origin !== `${secure ? 'https' : 'http'}://${request.headers.host}`) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }
        try {
            webSockets.handleUpgrade(request, socket, head, connection => {
                const transport = new WebSocketTransport(connection);
                try {
                    const trusted: NativeRequestContext = { ...native?.(request), secure };
                    const incoming = new Request(url, {
                        headers: new Headers(request.headers as Record<string, string>), signal: transport.signal
                    });
                    const work = directWebSocket(arc, incoming, transport, trusted);
                    const active = { transport, work };
                    connections.add(active);
                    const release = (): void => { connections.delete(active); transport.close(); };
                    void work.then(release, release);
                } catch { transport.close(); }
            });
        } catch { socket.destroy(); }
    };
    host.on('upgrade', onUpgrade);
    let closing: Promise<void> | undefined;
    const dispose = (): Promise<void> => {
        if (closing) return closing;
        host.off('upgrade', onUpgrade);
        owned.delete(host);
        for (const connection of connections) connection.transport.close();
        closing = Promise.allSettled([...connections].map(connection => connection.work)).then(outcomes => {
            const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
            if (failures.length) throw new AggregateError(failures, 'Arc WebSocket shutdown failed');
        });
        return closing;
    };
    owned.set(host, dispose);
    bridges.set(arc, owned);
    return dispose;
}

/** Server shutdown cancels and joins every bridge it owns before closing service scopes. */
export function closeNodeWebSockets(arc: ArcServer): Promise<void> | undefined {
    const owned = bridges.get(arc);
    if (!owned?.size) return undefined;
    return Promise.allSettled([...owned.values()].map(dispose => dispose())).then(outcomes => {
        const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
        if (failures.length) throw new AggregateError(failures, 'Arc WebSocket shutdown failed');
    });
}
