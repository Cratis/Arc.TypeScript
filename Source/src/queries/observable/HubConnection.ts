// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import type { ArcServer } from '../../ArcServer.js';
import { BadRequest } from '../../binding.js';
import type { ExecutionContext } from '../../ExecutionContext.js';
import { HubFrameType } from './HubFrameType.js';
import type { HubSubscription } from './HubSubscription.js';
import { HubSubscriptionOutcome } from './HubSubscriptionOutcome.js';
import { HubSubscriptionRunner } from './HubSubscriptionRunner.js';
import type { HubTransport } from './HubTransport.js';
import { ObservableTransfer } from './ObservableTransfer.js';
import { parseHubRequest } from './parseHubRequest.js';
import { SubscriptionRevisions } from './SubscriptionRevisions.js';
import { observableCallerKey } from './observableCallerKey.js';
import { clonePrincipal } from './clonePrincipal.js';

/** Owns bounded, revision-aware subscriptions on one physical WS or SSE connection. */
export class HubConnection {
    readonly id = randomUUID();
    readonly establishedAt = new Date().toISOString();
    readonly #states: SubscriptionRevisions;
    readonly #subscriptions = new Map<string, HubSubscription>();
    readonly #context: ExecutionContext;
    readonly ownerKey: string;
    #keepAlive: ReturnType<typeof setTimeout> | undefined;
    #removeActivity: (() => void) | undefined;
    #closing: Promise<void> | undefined;

    constructor(
        readonly server: ArcServer,
        readonly protocol: 'WebSocket' | 'SSE',
        readonly output: HubTransport,
        context: ExecutionContext,
        readonly intervalMs: number,
        readonly onClose: () => void,
        readonly onChange: () => void
    ) {
        this.ownerKey = observableCallerKey(context, false);
        this.#context = Object.freeze({ ...context, connectionId: this.id,
            principal: clonePrincipal(context.principal), signal: AbortSignal.any([context.signal, output.signal]) });
        this.#states = new SubscriptionRevisions(server.observableLimits.tombstones);
        output.signal.addEventListener('abort', () => { void this.close(); }, { once: true });
    }

    get context(): ExecutionContext { return this.#context; }
    get subscriptionCount(): number { return this.#states.activeCount; }
    get subscriptions(): readonly HubSubscription[] { return [...this.#subscriptions.values()]; }
    get closed(): boolean { return this.#closing !== undefined; }

    /** Advertise revisions promptly, including when a WS client sent a legacy Subscribe on open. */
    async connect(): Promise<void> {
        await this.output.send({ type: HubFrameType.Connected, payload: this.id,
            keepAliveIntervalMs: this.intervalMs, supportsSubscriptionRevisions: true });
        if (this.intervalMs > 0) {
            this.#removeActivity = this.output.onActivity?.(() => this.scheduleKeepAlive());
            this.scheduleKeepAlive();
        }
    }

    private scheduleKeepAlive(): void {
        if (this.closed || this.intervalMs <= 0) return;
        if (this.#keepAlive) clearTimeout(this.#keepAlive);
        const remaining = this.output.lastActivity + this.intervalMs - Date.now();
        this.#keepAlive = setTimeout(() => {
            if (this.closed) return;
            if (Date.now() - this.output.lastActivity < this.intervalMs) {
                this.scheduleKeepAlive();
                return;
            }
            void this.output.send({ type: HubFrameType.Ping })
                .then(() => this.scheduleKeepAlive(), () => this.close());
        }, Math.max(1, remaining));
    }

    /** Process a bounded WS control frame without letting one slow producer block later revisions. */
    async accept(raw: string): Promise<void> {
        try {
            if (Buffer.byteLength(raw) > this.server.observableLimits.inboundFrameBytes) throw new BadRequest();
            const frame: unknown = JSON.parse(raw);
            if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new BadRequest();
            const message = frame as Record<string, unknown>;
            if (message.type === HubFrameType.Ping) {
                if (typeof message.timestamp === 'number' && Number.isSafeInteger(message.timestamp))
                    await this.output.send({ type: HubFrameType.Pong, timestamp: message.timestamp });
                return;
            }
            if (message.type === HubFrameType.Pong) return;
            if (message.type !== HubFrameType.Subscribe && message.type !== HubFrameType.Unsubscribe) throw new BadRequest();
            const queryId = this.queryId(message.queryId);
            const revision = this.revision(message);
            if (message.type === HubFrameType.Unsubscribe) {
                await this.unsubscribe(queryId, revision);
                return;
            }
            void this.subscribe(queryId, revision, message.payload).catch(() => this.close());
        } catch {
            if (!this.closed) await this.output.send({ type: HubFrameType.Error, payload: 'Malformed query control' });
        }
    }

    /** A POST may await admission to distinguish unauthorized from accepted SSE subscriptions. */
    subscribe(queryId: string, revision: number | undefined, payload: unknown): Promise<HubSubscriptionOutcome> {
        if (this.closed) return Promise.resolve(HubSubscriptionOutcome.Stale);
        this.queryId(queryId);
        const request = parseHubRequest(payload);
        const previous = this.#subscriptions.get(queryId);
        if (!previous && this.#states.activeCount >= this.server.observableLimits.hubSubscriptionsPerConnection) {
            return this.output.send({ type: HubFrameType.Error, queryId,
                ...(revision === undefined ? {} : { revision }), payload: 'Connection subscription limit reached' })
                .then(() => HubSubscriptionOutcome.Limited);
        }
        if (!this.#states.subscribe(queryId, revision, JSON.stringify(request)))
            return Promise.resolve(HubSubscriptionOutcome.Stale);
        if (previous) {
            previous.controller.abort();
            void previous.session?.close().catch(error => this.recordCleanupFailure(error));
        }
        const subscription: HubSubscription = { queryId, queryName: request.queryName,
            connectedAt: new Date().toISOString(), revision, transfer: new ObservableTransfer(request.transferMode),
            controller: new AbortController() };
        this.#subscriptions.set(queryId, subscription);
        this.onChange();
        const current = (): boolean => !this.closed && !this.output.signal.aborted &&
            this.#subscriptions.get(queryId) === subscription && this.#states.isActive(queryId, revision);
        const completed = (): void => {
            if (this.#subscriptions.get(queryId) !== subscription) return;
            this.#subscriptions.delete(queryId);
            this.#states.complete(queryId, revision);
            this.onChange();
        };
        const subscriptionContext = Object.freeze({ ...this.#context,
            signal: AbortSignal.any([this.#context.signal, subscription.controller.signal]) });
        const runner = new HubSubscriptionRunner(this.server, subscriptionContext, this.output, subscription,
            request, current, completed, this.onChange);
        const admission = runner.admit();
        subscription.admission = admission;
        return admission;
    }

    async unsubscribe(queryId: string, revision?: number): Promise<void> {
        if (!this.#states.unsubscribe(this.queryId(queryId), revision)) return;
        const current = this.#subscriptions.get(queryId);
        this.#subscriptions.delete(queryId);
        this.onChange();
        if (current) {
            current.controller.abort();
            try { await current.session?.close(); }
            catch (error) { await this.recordCleanupFailure(error); }
        }
    }

    private async recordCleanupFailure(error: unknown): Promise<void> {
        this.server.recordObservableCleanupFailure(error);
        try { await this.server.options.logger?.(error, this.#context.correlationId); }
        catch (loggingError) { this.server.recordObservableCleanupFailure(loggingError); }
    }

    close(): Promise<void> {
        if (this.#closing) return this.#closing;
        if (this.#keepAlive) clearTimeout(this.#keepAlive);
        this.#removeActivity?.();
        this.#closing = Promise.resolve().then(async () => {
            this.output.close();
            const errors: unknown[] = [];
            const active = [...this.#subscriptions.values()];
            this.#subscriptions.clear();
            for (const subscription of active) subscription.controller.abort();
            const joined = Promise.allSettled(active.map(async subscription => {
                await subscription.session?.close();
                await subscription.admission;
                await subscription.delivery;
            }));
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const results = await Promise.race([
                    joined,
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(() => reject(new Error('Observable hub shutdown timed out')),
                            this.server.observableLimits.handshakeTimeoutMs);
                    })
                ]);
                for (const result of results) if (result.status === 'rejected') errors.push(result.reason);
            } catch (error) { errors.push(error); }
            finally { if (timer) clearTimeout(timer); }
            for (const error of errors) await this.recordCleanupFailure(error);
            this.onClose();
            this.onChange();
        });
        return this.#closing;
    }

    revision(message: Record<string, unknown>): number | undefined {
        if (!Object.hasOwn(message, 'revision')) return undefined;
        if (!SubscriptionRevisions.valid(message.revision)) throw new BadRequest();
        return message.revision;
    }

    queryId(value: unknown): string {
        if (typeof value !== 'string' || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value))
            throw new BadRequest();
        return value;
    }
}
