// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { utf8Bytes } from '../../http/utf8Bytes.js';
import type { ArcServer } from '../../ArcServer.js';
import { BadRequest } from '../../http/BadRequest.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import { HubFrameType } from './HubFrameType.js';
import { HubKeepAlive } from './HubKeepAlive.js';
import type { HubSubscription } from './HubSubscription.js';
import { HubSubscriptionOutcome } from './HubSubscriptionOutcome.js';
import { HubSubscriptionRunner } from './HubSubscriptionRunner.js';
import type { HubTransport } from './HubTransport.js';
import { ObservableTransfer } from './ObservableTransfer.js';
import { parseHubRequest } from './parseHubRequest.js';
import { SubscriptionRevisions } from './SubscriptionRevisions.js';
import { observableCallerKey } from './observableCallerKey.js';
import { clonePrincipal } from './clonePrincipal.js';
import { recordObservableCleanupFailure } from './observableCleanupFailures.js';

/** Owns bounded, revision-aware subscriptions on one physical WS or SSE connection. */
export class HubConnection {
    readonly id = crypto.randomUUID();
    readonly establishedAt = new Date().toISOString();
    readonly #states: SubscriptionRevisions;
    readonly #subscriptions = new Map<string, HubSubscription>();
    readonly #context: ExecutionContext;
    readonly ownerKey: string;
    readonly #keepAlive: HubKeepAlive;
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
        this.#keepAlive = new HubKeepAlive(output, intervalMs, () => { void this.close().catch(() => {}); });
        output.signal.addEventListener('abort', () => { void this.close().catch(() => {}); }, { once: true });
    }

    get context(): ExecutionContext { return this.#context; }
    get subscriptionCount(): number { return this.#states.activeCount; }
    get subscriptions(): readonly HubSubscription[] { return [...this.#subscriptions.values()]; }
    get closed(): boolean { return this.#closing !== undefined; }

    /** Advertise revisions promptly, including when a WS client sent a legacy Subscribe on open. */
    async connect(): Promise<void> {
        await this.output.send({ type: HubFrameType.Connected, payload: this.id,
            keepAliveIntervalMs: this.intervalMs, supportsSubscriptionRevisions: true });
        this.#keepAlive.start();
    }

    /** Process a bounded WS control frame without letting one slow producer block later revisions. */
    async accept(raw: string): Promise<void> {
        try {
            if (utf8Bytes(raw) > this.server.observableLimits.inboundFrameBytes) throw new BadRequest();
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
                void this.unsubscribe(queryId, revision).catch(() => this.close()).catch(() => {});
                return;
            }
            void this.subscribe(queryId, revision, message.payload).catch(() => this.close()).catch(() => {});
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
            void previous.session?.close().catch(error => this.recordCleanupFailure(previous, error));
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
            catch (error) { await this.recordCleanupFailure(current, error); }
        }
    }

    private async recordCleanupFailure(subscription: HubSubscription, error: unknown): Promise<void> {
        if (!recordObservableCleanupFailure(this.server, subscription)) return;
        try { await this.server.options.logger?.(error, this.#context.correlationId); }
        catch { /* Cleanup was already recorded; a failing logger must not orphan the connection. */ }
    }

    close(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#keepAlive.stop();
        this.#closing = Promise.resolve().then(async () => {
            this.output.close();
            const errors: unknown[] = [];
            const active = [...this.#subscriptions.values()];
            this.#subscriptions.clear();
            for (const subscription of active) subscription.controller.abort();
            const joined = Promise.allSettled(active.map(async subscription => {
                try {
                    await subscription.session?.close();
                    await subscription.admission;
                    await subscription.delivery;
                } catch (error) { await this.recordCleanupFailure(subscription, error); }
            }));
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const results = await Promise.race([
                    joined,
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(() => reject(new Error('Observable hub shutdown timed out')),
                            this.server.observableLimits.shutdownTimeoutMs);
                    })
                ]);
                for (const result of results) if (result.status === 'rejected') errors.push(result.reason);
            } catch (error) { errors.push(error); }
            finally { if (timer) clearTimeout(timer); }
            this.onClose();
            this.onChange();
            if (errors.length === 1) throw errors[0];
            if (errors.length) throw new AggregateError(errors, 'Observable hub shutdown failed');
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
