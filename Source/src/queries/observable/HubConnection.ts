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

/** Owns bounded, revision-aware subscriptions on one physical WS or SSE connection. */
export class HubConnection {
    readonly id = randomUUID();
    readonly establishedAt = new Date().toISOString();
    readonly #states = new SubscriptionRevisions();
    readonly #subscriptions = new Map<string, HubSubscription>();
    readonly #context: ExecutionContext;
    #keepAlive: ReturnType<typeof setInterval> | undefined;
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
        this.#context = Object.freeze({ ...context, signal: AbortSignal.any([context.signal, output.signal]) });
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
            this.#keepAlive = setInterval(() => {
                if (Date.now() - this.output.lastActivity < this.intervalMs) return;
                void this.output.send({ type: HubFrameType.Ping }).catch(() => this.close());
            }, this.intervalMs);
        }
    }

    /** Process a bounded WS control frame without letting one slow producer block later revisions. */
    async accept(raw: string): Promise<void> {
        try {
            if (raw.length > 64 * 1024) throw new BadRequest();
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
        if (!previous && this.#states.activeCount >= 32) {
            return this.output.send({ type: HubFrameType.Error, queryId,
                ...(revision === undefined ? {} : { revision }), payload: 'Connection subscription limit reached' })
                .then(() => HubSubscriptionOutcome.Limited);
        }
        if (!this.#states.subscribe(queryId, revision, JSON.stringify(request)))
            return Promise.resolve(HubSubscriptionOutcome.Stale);
        if (previous) void previous.session?.close().catch(() => this.close());
        const subscription: HubSubscription = { queryId, queryName: request.queryName,
            connectedAt: new Date().toISOString(), revision, transfer: new ObservableTransfer(request.transferMode) };
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
        const runner = new HubSubscriptionRunner(this.server, this.#context, this.output, subscription,
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
        if (current) await current.session?.close();
    }

    close(): Promise<void> {
        if (this.#closing) return this.#closing;
        if (this.#keepAlive) clearInterval(this.#keepAlive);
        this.#closing = Promise.resolve().then(async () => {
            this.output.close();
            const errors: unknown[] = [];
            const active = [...this.#subscriptions.values()];
            this.#subscriptions.clear();
            const results = await Promise.allSettled(active.map(async subscription => {
                await subscription.session?.close();
                await subscription.admission;
                await subscription.delivery;
            }));
            for (const result of results) if (result.status === 'rejected') errors.push(result.reason);
            this.onClose();
            this.onChange();
            if (errors.length) throw new AggregateError(errors, 'Observable hub cleanup failed');
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
