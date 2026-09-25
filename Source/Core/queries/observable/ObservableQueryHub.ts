// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import { CurrentValueSubject } from './CurrentValueSubject.js';
import type { ObservableSource } from './ObservableSource.js';
import { buildQueryHealth } from './buildQueryHealth.js';
import { FilteredHealthSource } from './FilteredHealthSource.js';
import type { QueryHealthSnapshot } from './QueryHealthSnapshot.js';
import { observableCallerKey } from './observableCallerKey.js';
import { originAllowed } from './originAllowed.js';
import { BadRequest } from '../../http/BadRequest.js';
import { body } from '../../http/body.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';
import { HubConnection } from './HubConnection.js';
import { HubSubscriptionOutcome } from './HubSubscriptionOutcome.js';
import { parseHubRequest } from './parseHubRequest.js';
import { resolveConnectionContext } from './resolveConnectionContext.js';
import type { ResolvedConnectionContext } from './ResolvedConnectionContext.js';
import { correlation } from '../../execution/correlation.js';
import { SseHubTransport } from './SseHubTransport.js';
import type { ObservableSocket } from './ObservableSocket.js';

const ssePath = '/.cratis/queries/sse';
const subscribePath = `${ssePath}/subscribe`;
const unsubscribePath = `${ssePath}/unsubscribe`;

/** Owns connection IDs and caller-bound control; query execution stays in per-subscription sessions. */
export class ObservableQueryHub {
    readonly #connections = new Map<string, HubConnection>();
    readonly #healthChanged = new CurrentValueSubject(0);
    #healthVersion = 0;
    #disposed = false;

    constructor(readonly server: ArcServer) {}

    get connections(): readonly HubConnection[] { return [...this.#connections.values()]; }

    canAdmit(context: ExecutionContext): boolean {
        if (this.#disposed || this.#connections.size >= this.server.observableLimits.hubConnections) return false;
        const key = observableCallerKey(context);
        return this.connections.filter(connection => connection.ownerKey === key).length <
            this.server.observableLimits.hubConnectionsPerCaller;
    }

    /** Health has a current value and emits only this authenticated caller's connections. */
    observeHealth(caller: ExecutionContext): ObservableSource<QueryHealthSnapshot> {
        return new FilteredHealthSource(this.#healthChanged, () => buildQueryHealth(this.connections, caller));
    }

    private changed(): void {
        if (this.#disposed) return;
        this.#healthChanged.next(++this.#healthVersion);
    }

    /** One physical upgraded socket may carry many revision-aware subscriptions. */
    async webSocket(request: Request, output: ObservableSocket, native?: NativeRequestContext,
        resolved?: ResolvedConnectionContext): Promise<void> {
        let connection: HubConnection | undefined;
        let correlationId = resolved?.context.correlationId ??
            correlation(request.headers.get(this.server.options.correlationId?.httpHeader ?? 'X-Correlation-ID'));
        try {
            const identity = resolved ?? await resolveConnectionContext(this.server, request, native);
            correlationId = identity.context.correlationId;
            if (identity.authenticationFailed || !this.canAdmit(identity.context)) {
                output.close(identity.authenticationFailed ? 1008 : 1013,
                    identity.authenticationFailed ? 'Unauthorized' : 'Hub capacity reached');
                return;
            }
            connection = new HubConnection(this.server, 'WebSocket', output, identity.context,
                this.server.options.query?.keepAliveIntervalMs ?? 30_000,
                () => { this.#connections.delete(connection!.id); this.changed(); }, () => this.changed());
            this.#connections.set(connection.id, connection);
            this.changed();
            await connection.connect();
            for await (const raw of output) await connection.accept(raw);
        } catch (error) {
            await this.server.options.logger?.(error, correlationId);
        } finally {
            if (connection) await connection.close();
            else output.close();
        }
    }

    /** SSE connections capture their caller so later control requests cannot cross identity boundaries. */
    async http(request: Request, native?: NativeRequestContext): Promise<Response> {
        const path = new URL(request.url).pathname;
        if (path === ssePath) {
            if (request.method !== 'GET') return this.methodNotAllowed('GET');
            return this.openSse(request, native);
        }
        if (request.method !== 'POST') return this.methodNotAllowed('POST');
        if (path === subscribePath || path === unsubscribePath) return this.control(request, path, native);
        return new Response(null, { status: 404 });
    }

    async dispose(): Promise<void> {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#healthChanged.complete();
        const outcomes = await Promise.allSettled([...this.#connections.values()].map(connection => connection.close()));
        const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
        if (failures.length) throw new AggregateError(failures, 'Observable hub shutdown failed');
    }

    private async openSse(request: Request, native?: NativeRequestContext): Promise<Response> {
        const correlationId = correlation(request.headers.get(this.server.options.correlationId?.httpHeader ?? 'X-Correlation-ID'));
        try {
            if (!await originAllowed(request.headers.get('origin'), request, native, this.server.options))
                return new Response(null, { status: 403 });
            const identity = await resolveConnectionContext(this.server, request, native);
            if (identity.authenticationFailed) return new Response(null, { status: 401 });
            if (!this.canAdmit(identity.context))
                return new Response(null, { status: 503, headers: { 'retry-after': '1' } });
            const output = new SseHubTransport(this.server.observableLimits);
            const connection = new HubConnection(this.server, 'SSE', output, identity.context,
                this.server.options.query?.keepAliveIntervalMs ?? 30_000,
                () => { this.#connections.delete(connection.id); this.changed(); }, () => this.changed());
            this.#connections.set(connection.id, connection);
            this.changed();
            const headers = new Headers({
                'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache',
                connection: 'keep-alive', 'x-accel-buffering': 'no',
                [this.server.options.correlationId?.httpHeader ?? 'X-Correlation-ID']: identity.context.correlationId
            });
            void connection.connect().catch(async error => {
                try { await this.server.options.logger?.(error, identity.context.correlationId); }
                finally { await connection.close(); }
            }).catch(() => output.close());
            return new Response(output.body, { status: 200, headers });
        } catch (error) {
            await this.server.options.logger?.(error, correlationId);
            return new Response(null, { status: 500 });
        }
    }

    private async control(request: Request, path: string, native?: NativeRequestContext): Promise<Response> {
        const correlationId = correlation(request.headers.get(this.server.options.correlationId?.httpHeader ?? 'X-Correlation-ID'));
        try {
            const contentType = request.headers.get('content-type');
            if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType))
                return new Response(null, { status: 415 });
            if (!await originAllowed(request.headers.get('origin'), request, native, this.server.options))
                return new Response(null, { status: 403 });
            const maximum = Math.min(this.server.options.hosting?.maxBodyBytes ?? 1024 * 1024,
                this.server.observableLimits.inboundFrameBytes);
            const payload = await body(request, maximum);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequest();
            const raw = payload as Record<string, unknown>;
            if (typeof raw.connectionId !== 'string' || typeof raw.queryId !== 'string') throw new BadRequest();
            if (path === subscribePath) parseHubRequest(raw.request);
            const connection = this.#connections.get(raw.connectionId);
            const identity = await resolveConnectionContext(this.server, request, native);
            if (!connection || connection.protocol !== 'SSE' || connection.closed || identity.authenticationFailed ||
                !this.sameCaller(connection, identity.context))
                return new Response(null, { status: 404 });
            const revision = connection.revision(raw);
            const queryId = connection.queryId(raw.queryId);
            if (path === unsubscribePath) {
                await connection.unsubscribe(queryId, revision);
                return new Response(null, { status: 200 });
            }
            const outcome = await connection.subscribe(queryId, revision, raw.request);
            return new Response(null, { status: outcome === HubSubscriptionOutcome.Unauthorized ? 401
                : outcome === HubSubscriptionOutcome.Limited ? 503 : 200 });
        } catch (error) {
            if (error instanceof BadRequest) return new Response(null, { status: 400 });
            await this.server.options.logger?.(error, correlationId);
            return new Response(null, { status: 500 });
        }
    }

    private sameCaller(connection: HubConnection, caller: ExecutionContext): boolean {
        const owner = connection.context;
        if (owner.tenantId !== caller.tenantId) return false;
        const ownerAuthenticated = owner.principal?.isAuthenticated === true;
        if (ownerAuthenticated !== (caller.principal?.isAuthenticated === true)) return false;
        if (ownerAuthenticated) return !!caller.principal?.id && owner.principal?.id === caller.principal.id;
        // Anonymous callers have no identity to distinguish them. Bind to the peer address when
        // the host supplies one; never treat a missing address as equivalent to a known address.
        return owner.remoteAddress === caller.remoteAddress;
    }

    private methodNotAllowed(allow: string): Response {
        return new Response(null, { status: 405, headers: { allow } });
    }
}
