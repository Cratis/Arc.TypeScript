// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import type { ExecutionContext } from '../../ExecutionContext.js';
import { CurrentValueSubject } from './CurrentValueSubject.js';
import type { ObservableSource } from './ObservableSource.js';
import { buildQueryHealth } from './buildQueryHealth.js';
import type { QueryHealthSnapshot } from './QueryHealthSnapshot.js';
import { BadRequest, body } from '../../binding.js';
import type { NativeRequestContext } from '../../NativeRequestContext.js';
import { HubConnection } from './HubConnection.js';
import { HubSubscriptionOutcome } from './HubSubscriptionOutcome.js';
import { parseHubRequest } from './parseHubRequest.js';
import { resolveConnectionContext } from './resolveConnectionContext.js';
import { SseHubTransport } from './SseHubTransport.js';
import type { WebSocketTransport } from './WebSocketTransport.js';

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

    private canAdmit(context: ExecutionContext): boolean {
        if (this.#disposed || this.#connections.size >= 64) return false;
        const principal = context.principal?.isAuthenticated ? context.principal.id : undefined;
        const maximum = principal ? 8 : 4;
        const matching = this.connections.filter(connection =>
            connection.context.tenantId === context.tenantId &&
            (connection.context.principal?.isAuthenticated ? connection.context.principal.id : undefined) === principal);
        return matching.length < maximum;
    }

    /** Health has a current value and emits only this authenticated caller's connections. */
    observeHealth(caller: ExecutionContext): ObservableSource<QueryHealthSnapshot> {
        return {
            current: () => ({ hasValue: true, value: buildQueryHealth(this.connections, caller) }),
            subscribe: observer => this.#healthChanged.subscribe({
                next: () => observer.next(buildQueryHealth(this.connections, caller)),
                error: error => observer.error(error), complete: () => observer.complete()
            })
        };
    }

    private changed(): void {
        if (this.#disposed) return;
        this.#healthChanged.next(++this.#healthVersion);
    }

    /** One physical upgraded socket may carry many revision-aware subscriptions. */
    async webSocket(request: Request, output: WebSocketTransport, native?: NativeRequestContext): Promise<void> {
        let connection: HubConnection | undefined;
        try {
            const identity = await resolveConnectionContext(this.server, request, native);
            if (identity.authenticationFailed || !this.canAdmit(identity.context)) {
                output.close();
                return;
            }
            connection = new HubConnection(this.server, 'WebSocket', output, identity.context,
                this.server.options.observableKeepAliveIntervalMs ?? 30_000,
                () => { this.#connections.delete(connection!.id); this.changed(); }, () => this.changed());
            this.#connections.set(connection.id, connection);
            this.changed();
            await connection.connect();
            for await (const raw of output) await connection.accept(raw);
        } catch (error) {
            await this.server.options.logger?.(error, 'websocket-hub');
        } finally {
            if (connection) await connection.close();
            else output.close();
        }
    }

    /** SSE opening is authenticated; an anonymous connection ID never authorizes control POSTs. */
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
        try {
            const identity = await resolveConnectionContext(this.server, request, native);
            if (identity.authenticationFailed || !identity.context.principal?.isAuthenticated)
                return new Response(null, { status: 401 });
            if (!this.canAdmit(identity.context))
                return new Response(null, { status: 503, headers: { 'retry-after': '1' } });
            const output = new SseHubTransport();
            const connection = new HubConnection(this.server, 'SSE', output, identity.context,
                this.server.options.observableKeepAliveIntervalMs ?? 30_000,
                () => { this.#connections.delete(connection.id); this.changed(); }, () => this.changed());
            this.#connections.set(connection.id, connection);
            this.changed();
            const headers = new Headers({
                'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache',
                connection: 'keep-alive', 'x-accel-buffering': 'no',
                [this.server.options.correlationHeader ?? 'X-Correlation-ID']: identity.context.correlationId
            });
            void connection.connect().catch(async error => {
                try { await this.server.options.logger?.(error, identity.context.correlationId); }
                finally { await connection.close(); }
            }).catch(() => output.close());
            return new Response(output.body, { status: 200, headers });
        } catch (error) {
            await this.server.options.logger?.(error, 'sse-hub');
            return new Response(null, { status: 500 });
        }
    }

    private async control(request: Request, path: string, native?: NativeRequestContext): Promise<Response> {
        try {
            const payload = await body(request, this.server.options.maxBodyBytes ?? 1024 * 1024);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequest();
            const raw = payload as Record<string, unknown>;
            if (typeof raw.connectionId !== 'string' || typeof raw.queryId !== 'string') throw new BadRequest();
            if (path === subscribePath) parseHubRequest(raw.request);
            const connection = this.#connections.get(raw.connectionId);
            const identity = await resolveConnectionContext(this.server, request, native);
            if (!connection || connection.protocol !== 'SSE' || connection.closed || identity.authenticationFailed ||
                !this.sameCaller(connection, identity.context.principal?.id, identity.context.tenantId, request, native))
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
            await this.server.options.logger?.(error, 'sse-hub-control');
            return new Response(null, { status: 500 });
        }
    }

    private sameCaller(connection: HubConnection, id: string | undefined, tenant: string | undefined,
        request: Request, native?: NativeRequestContext): boolean {
        const owner = connection.context.principal;
        if (!owner?.isAuthenticated || !id || owner.id !== id || connection.context.tenantId !== tenant) return false;
        const origin = request.headers.get('origin');
        if (!origin) return true;
        return origin === `${native?.secure ? 'https' : 'http'}://${request.headers.get('host')}`;
    }

    private methodNotAllowed(allow: string): Response {
        return new Response(null, { status: 405, headers: { allow } });
    }
}
