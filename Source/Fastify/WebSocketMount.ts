// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TLSSocket } from 'node:tls';
import websocket from '@fastify/websocket';
import fastifyPlugin from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ObservableHandshakeTimeoutError, prepareObservableUpgrade, serveUpgradedSocket,
    withObservableHandshakeTimeout, observableLimits } from '@cratis/arc.core/hosting';
import type { NodeWebSocketLike } from '@cratis/arc.core/hosting';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.core';

interface PreparedUpgrade {
    readonly request: Request;
    readonly native: NativeRequestContext;
    readonly resolved: NonNullable<Awaited<ReturnType<typeof prepareObservableUpgrade>>['resolved']>;
}

const mounts = new WeakMap<FastifyInstance, FastifyWebSocketMount>();

/** Let Fastify hooks authenticate the request before the plugin upgrades a route. */
export class FastifyWebSocketMount {
    readonly #prepared = new WeakMap<FastifyRequest, PreparedUpgrade>();
    readonly #sockets = new Set<{ close(): void; completion: Promise<void> }>();
    constructor(readonly server: ArcServer,
        readonly native?: (request: FastifyRequest) => NativeRequestContext | Promise<NativeRequestContext>) {}

    async preValidation(request: FastifyRequest, reply: FastifyReply, path: string): Promise<void> {
        if (request.headers.upgrade?.toLowerCase() !== 'websocket') return;
        const raw = request.raw.url ?? '';
        if (raw.split('?')[0] !== path) { await reply.code(404).send(); return; }
        const url = new URL(raw, 'http://arc.invalid');
        if (url.origin !== 'http://arc.invalid' || url.pathname !== path) {
            await reply.code(400).send();
            return;
        }
        try {
            const prepared = await withObservableHandshakeTimeout(async () => {
                const supplied = await this.native?.(request);
                const verified: NativeRequestContext = { ...supplied,
                    secure: supplied?.secure ?? (request.raw.socket instanceof TLSSocket && request.raw.socket.encrypted === true),
                    remoteAddress: supplied?.remoteAddress ?? request.raw.socket.remoteAddress };
                const incoming = new Request(url, { headers: new Headers(request.headers as Record<string, string>) });
                const outcome = await prepareObservableUpgrade(this.server, incoming, verified);
                return { verified, incoming, outcome };
            }, observableLimits(this.server).handshakeTimeoutMs);
            if (prepared.outcome.status !== 101 || !prepared.outcome.resolved) {
                await reply.code(prepared.outcome.status).send();
                return;
            }
            this.#prepared.set(request, { request: prepared.incoming, native: prepared.verified,
                resolved: prepared.outcome.resolved });
        } catch (error) {
            if (!(error instanceof ObservableHandshakeTimeoutError))
                await this.server.options.logger?.(error, String(request.id));
            await reply.code(error instanceof ObservableHandshakeTimeoutError ? 408 : 500).send();
        }
    }

    handle(socket: NodeWebSocketLike, request: FastifyRequest): void {
        const prepared = this.#prepared.get(request);
        this.#prepared.delete(request);
        if (!prepared) {
            socket.close(1008, 'Upgrade not authorized');
            return;
        }
        const bridge = serveUpgradedSocket(this.server, socket, prepared.request, prepared.native, prepared.resolved);
        this.#sockets.add(bridge);
        const release = (): void => { this.#sockets.delete(bridge); bridge.close(); };
        void bridge.completion.then(release, release);
    }

    async dispose(): Promise<void> {
        const owned = [...this.#sockets];
        for (const socket of owned) socket.close();
        const outcomes = await Promise.allSettled(owned.map(socket => socket.completion));
        const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
        if (failures.length) throw new AggregateError(failures, 'Fastify observable WebSocket cleanup failed');
    }
}

/** Register before mountFastify and before listen; onClose releases Arc-owned sockets and scopes. */
export function mountFastifyWebSockets(app: FastifyInstance, server: ArcServer,
    native?: (request: FastifyRequest) => NativeRequestContext | Promise<NativeRequestContext>): () => Promise<void> {
    if (mounts.has(app)) throw new Error('Fastify observable WebSockets are already mounted');
    const mount = new FastifyWebSocketMount(server, native);
    mounts.set(app, mount);
    const onUpgrade = (request: import('node:http').IncomingMessage, socket: import('node:net').Socket): void => {
        if (!server.endpoints.has(request.url?.split('?')[0] ?? '')) return;
        const onSocketError = (): void => { socket.destroy(); };
        socket.on('error', onSocketError);
        socket.once('close', () => socket.off('error', onSocketError));
    };
    app.server.prependListener('upgrade', onUpgrade);
    app.register(fastifyPlugin(async instance => {
        if (!instance.hasRequestDecorator('ws'))
            await instance.register(websocket, { options: { maxPayload: observableLimits(server).inboundFrameBytes } });
    }));
    app.addHook('onClose', async () => {
        app.server.off('upgrade', onUpgrade);
        await mount.dispose();
    });
    return () => mount.dispose();
}

export function fastifyWebSocketMount(app: FastifyInstance): FastifyWebSocketMount | undefined { return mounts.get(app); }
