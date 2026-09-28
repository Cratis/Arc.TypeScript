// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Socket } from 'node:net';
import { TLSSocket } from 'node:tls';
import { WebSocket, WebSocketServer } from 'ws';
import type { ArcServer } from '../../ArcServer.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';
import { correlation } from '../../execution/correlation.js';
import { stripPathBase } from '../../http/requestPath.js';
import { directWebSocket } from './directWebSocket.js';
import { prepareObservableUpgrade } from './prepareObservableUpgrade.js';
import { WebSocketTransport } from './WebSocketTransport.js';
import { handleObservableHubSocket } from './observableHosting.js';
import type { ShutdownTransaction } from '../../dependencyInjection/ShutdownTransaction.js';

interface Bridge {
    releaseTransport(): Promise<void>;
    joinDelivery(): Promise<void>;
    dispose(): Promise<void>;
}
const bridges = new WeakMap<ArcServer, Map<HttpServer, Bridge>>();
const reasons: Record<number, string> = {
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    408: 'Request Timeout', 426: 'Upgrade Required', 500: 'Internal Server Error', 503: 'Service Unavailable'
};

/** Node upgrade bridge; an async trusted host callback runs before the WebSocket handshake. */
export function attachNodeWebSockets(host: HttpServer, arc: ArcServer,
    native?: (request: IncomingMessage) => NativeRequestContext | Promise<NativeRequestContext>,
    pathBase = ''): () => Promise<void> {
    const owned = bridges.get(arc) ?? new Map<HttpServer, Bridge>();
    if (owned.has(host)) throw new Error('Arc WebSocket bridge is already mounted on this server');
    const webSockets = new WebSocketServer({ noServer: true, maxPayload: arc.observableLimits.inboundFrameBytes,
        perMessageDeflate: false });
    const connections = new Set<{ transport: WebSocketTransport; work: Promise<void> }>();
    const onUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer): void => {
        const raw = request.url ?? '';
        const rawPath = raw.split('?')[0];
        const path = rawPath ? stripPathBase(rawPath, pathBase) : undefined;
        const correlationHeader = (arc.options.correlationId?.httpHeader ?? 'X-Correlation-ID').toLowerCase();
        const inbound = request.headers[correlationHeader];
        const correlationId = correlation(typeof inbound === 'string' ? inbound : null);
        const reject = (code: number): void => {
            if (socket.destroyed) return;
            socket.setTimeout(0);
            const retry = code === 503 ? 'Retry-After: 1\r\n' : '';
            socket.end(`HTTP/1.1 ${code} ${reasons[code]}\r\nConnection: close\r\nContent-Length: 0\r\n` +
                `${arc.options.correlationId?.httpHeader ?? 'X-Correlation-ID'}: ${correlationId}\r\n${retry}\r\n`, () => socket.destroy());
        };
        if (!path || !arc.endpoints.has(path)) {
            let ownedAlias: boolean;
            try { ownedAlias = !!path && arc.endpoints.has(decodeURIComponent(path)); }
            catch { ownedAlias = true; }
            if (ownedAlias || host.listenerCount('upgrade') === 1) {
                socket.on('error', () => socket.destroy());
                reject(404);
            }
            return;
        }
        const onSocketError = (): void => { socket.destroy(); };
        socket.on('error', onSocketError);
        socket.once('close', () => socket.off('error', onSocketError));
        const perform = async (): Promise<void> => {
            let url: URL;
            try { url = new URL(raw, 'http://arc.invalid'); }
            catch { reject(400); return; }
            if (url.origin !== 'http://arc.invalid' || url.pathname !== rawPath) { reject(400); return; }
            const routed = new URL(`${path}${url.search}`, 'http://arc.invalid');
            socket.setTimeout(arc.observableLimits.handshakeTimeoutMs, () => reject(408));
            const provided = await native?.(request);
            if (socket.destroyed || closing || transportClosing) { if (closing || transportClosing) reject(503); return; }
            const trusted: NativeRequestContext = { ...provided,
                secure: provided?.secure ?? (request.socket instanceof TLSSocket && request.socket.encrypted === true),
                remoteAddress: provided?.remoteAddress ?? request.socket.remoteAddress };
            const handshake = new Request(routed, { headers: new Headers(request.headers as Record<string, string>) });
            const prepared = await prepareObservableUpgrade(arc, handshake, trusted);
            if (prepared.status !== 101 || !prepared.resolved) { reject(prepared.status); return; }
            if (socket.destroyed || closing || transportClosing) { if (closing || transportClosing) reject(503); return; }
            socket.setTimeout(0);
            webSockets.handleUpgrade(request, socket, head, connection => {
                socket.off('error', onSocketError);
                const transport = new WebSocketTransport(connection, arc.observableLimits);
                const incoming = new Request(routed, {
                    headers: new Headers(request.headers as Record<string, string>), signal: transport.signal
                });
                const work = path === '/.cratis/queries/ws'
                    ? handleObservableHubSocket(arc, incoming, transport, trusted, prepared.resolved)
                    : directWebSocket(arc, incoming, transport, trusted, prepared.resolved);
                const active = { transport, work };
                connections.add(active);
                const release = (): void => { connections.delete(active); transport.close(); };
                void work.then(release, release);
            });
        };
        void perform().catch(async error => {
            try { await arc.options.logger?.(error, correlationId); }
            finally { reject(500); }
        }).catch(() => reject(500));
    };
    host.on('upgrade', onUpgrade);
    let closing: Promise<void> | undefined;
    let transportClosing: Promise<void> | undefined;
    let delivery: Promise<void> | undefined;
    let active: readonly { transport: WebSocketTransport; work: Promise<void> }[] = [];
    const releaseTransport = (): Promise<void> => {
        if (transportClosing) return transportClosing;
        // An uncoordinated dispose already closed the transport and removed this bridge.
        if (closing) return Promise.resolve();
        host.off('upgrade', onUpgrade);
        active = [...connections];
        const sockets = active.map(connection => {
            const socket = connection.transport.socket;
            const closed = new Promise<void>(resolve => {
                if (socket.readyState === WebSocket.CLOSED) resolve();
                else socket.on('close', () => resolve());
            });
            connection.transport.close();
            return closed;
        });
        transportClosing = (async () => {
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                for (const connection of active) connection.transport.socket.terminate();
            }, arc.observableLimits.shutdownTimeoutMs);
            try { await Promise.all(sockets); }
            finally { clearTimeout(timer); }
            if (timedOut) throw new Error('Arc WebSocket shutdown timed out');
        })();
        void transportClosing.catch(() => {});
        return transportClosing;
    };
    const joinDelivery = (): Promise<void> => {
        if (delivery) return delivery;
        if (closing && !transportClosing) return delivery = closing;
        const transport = releaseTransport();
        delivery = (async () => {
            try {
                const outcomes = await Promise.allSettled(active.map(connection => connection.work));
                const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
                if (failures.length) throw new AggregateError(failures, 'Arc WebSocket shutdown failed');
            } finally { void transport.finally(() => { owned.delete(host); }).catch(() => {}); }
        })();
        void delivery.catch(() => {});
        return delivery;
    };
    const dispose = (): Promise<void> => {
        if (closing) return closing;
        if (!transportClosing) return disposeUncoordinated();
        const transport = releaseTransport();
        const work = joinDelivery();
        closing = (async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const outcomes = await Promise.race([
                    Promise.allSettled([transport, work]),
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(() => {
                            for (const connection of active) connection.transport.socket.terminate();
                            reject(new Error('Arc WebSocket shutdown timed out'));
                        }, arc.observableLimits.shutdownTimeoutMs);
                    })
                ]);
                const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
                if (failures.length === 1) throw failures[0];
                if (failures.length) throw new AggregateError(failures, 'Arc WebSocket shutdown failed');
            } finally { if (timer) clearTimeout(timer); }
        })();
        void closing.catch(() => {});
        return closing;
    };
    // The original disposer, used whenever no shutdown transaction released this bridge first.
    const disposeUncoordinated = (): Promise<void> => {
        host.off('upgrade', onUpgrade);
        owned.delete(host);
        for (const connection of connections) connection.transport.close();
        const admitted = [...connections];
        closing = (async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const outcomes = await Promise.race([
                    Promise.allSettled(admitted.map(connection => connection.work)),
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(() => {
                            for (const connection of admitted) connection.transport.socket.terminate();
                            reject(new Error('Arc WebSocket shutdown timed out'));
                        }, arc.observableLimits.shutdownTimeoutMs);
                    })
                ]);
                const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
                if (failures.length) throw new AggregateError(failures, 'Arc WebSocket shutdown failed');
            } finally { if (timer) clearTimeout(timer); }
        })();
        return closing;
    };
    owned.set(host, { releaseTransport, joinDelivery, dispose });
    bridges.set(arc, owned);
    arc.closeWebSockets = () => closeNodeWebSockets(arc) ?? Promise.resolve();
    arc.coordinateWebSockets = transaction => coordinateNodeWebSockets(arc, transaction);
    return dispose;
}

/** Server shutdown cancels and joins every bridge it owns before closing service scopes. */
export function closeNodeWebSockets(arc: ArcServer): Promise<void> | undefined {
    const owned = bridges.get(arc);
    if (!owned?.size) return undefined;
    return Promise.allSettled([...owned.values()].map(bridge => bridge.dispose())).then(outcomes => {
        const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
        if (failures.length) throw new AggregateError(failures, 'Arc WebSocket shutdown failed');
    });
}

/** @internal Register in-progress bridges before participant stop. */
export function coordinateNodeWebSockets(arc: ArcServer, transaction: ShutdownTransaction): void {
    for (const bridge of bridges.get(arc)?.values() ?? []) {
        transaction.release(bridge.releaseTransport());
        transaction.work(() => bridge.joinDelivery());
    }
}
