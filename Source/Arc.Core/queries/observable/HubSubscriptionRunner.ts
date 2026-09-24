// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import { BadRequest } from '../../http/BadRequest.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import { isObservableOperation } from './ObservableOperation.js';
import { ObservableSubscriptionLimitError } from './ObservableSubscriptionLimitError.js';
import { ObservableTransportError } from './ObservableTransportError.js';
import { bindHubRequest } from './parseHubRequest.js';
import { HubFrameType } from './HubFrameType.js';
import type { HubRequest } from './HubRequest.js';
import type { HubSubscription } from './HubSubscription.js';
import { HubSubscriptionOutcome } from './HubSubscriptionOutcome.js';
import type { HubTransport } from './HubTransport.js';
import type { ObservableQuerySession } from './ObservableQuerySession.js';

/** Opens the real pipeline and serializes one generation's frames without stale writes. */
export class HubSubscriptionRunner {
    constructor(
        private readonly server: ArcServer,
        private readonly context: ExecutionContext,
        private readonly output: HubTransport,
        private readonly subscription: HubSubscription,
        private readonly request: HubRequest,
        private readonly isCurrent: () => boolean,
        private readonly onCompleted: () => void,
        private readonly onChange: () => void
    ) {}

    /** Await pipeline admission, not an indefinitely live source, on SSE control POST. */
    async admit(): Promise<HubSubscriptionOutcome> {
        const tag = this.tag();
        try {
            const operation = this.server.queries.find(item =>
                [item.namespace, item.name].filter(Boolean).join('.') === this.request.queryName);
            if (!operation || !isObservableOperation(operation)) {
                await this.output.send({ type: HubFrameType.Error, ...tag, payload: 'Unknown observable query' });
                this.onCompleted();
                return HubSubscriptionOutcome.Invalid;
            }
            const { input, options } = bindHubRequest(this.request, operation);
            const session = await this.server.openObservableQuery(this.request.queryName, input, this.context, options);
            this.subscription.session = session;
            if (!this.isCurrent()) { await this.closeSession(session); return HubSubscriptionOutcome.Stale; }
            if (session.rejection) {
                await this.output.send({ type: session.rejection.isAuthorized ? HubFrameType.Error : HubFrameType.Unauthorized,
                    ...tag, ...(session.rejection.isAuthorized ? { payload: 'Invalid observable query' } : {}) });
                await this.closeSession(session);
                this.onCompleted();
                return session.rejection.isAuthorized ? HubSubscriptionOutcome.Invalid : HubSubscriptionOutcome.Unauthorized;
            }
            const delivery = this.deliver(session);
            this.subscription.delivery = delivery;
            void delivery.catch(() => this.output.close());
            return HubSubscriptionOutcome.Accepted;
        } catch (error) {
            if (!this.isCurrent() || this.output.signal.aborted) {
                if (error instanceof ObservableTransportError)
                    await this.server.options.logger?.(error, this.context.correlationId);
                return HubSubscriptionOutcome.Stale;
            }
            try {
                if (!(error instanceof BadRequest) && !(error instanceof ObservableSubscriptionLimitError))
                    await this.server.options.logger?.(error, this.context.correlationId);
                const message = error instanceof ObservableSubscriptionLimitError
                    ? 'Subscription limit reached' : 'Observable query failed';
                await this.output.send({ type: HubFrameType.Error, ...tag, payload: message });
            } catch { this.output.close(); }
            if (this.subscription.session) await this.closeSession(this.subscription.session);
            this.onCompleted();
            return error instanceof ObservableSubscriptionLimitError ? HubSubscriptionOutcome.Limited : HubSubscriptionOutcome.Invalid;
        }
    }

    private async deliver(session: ObservableQuerySession): Promise<void> {
        const tag = this.tag();
        try {
            for await (const result of session.results()) {
                if (!this.isCurrent()) return;
                if (!result.isAuthorized) {
                    await this.output.send({ type: HubFrameType.Unauthorized, ...tag });
                    return;
                }
                if (!result.isSuccess) {
                    await this.output.send({ type: HubFrameType.Error, ...tag, payload: 'Observable query failed' });
                    return;
                }
                const frame = this.subscription.transfer.prepare(result);
                if (!this.isCurrent()) return;
                await this.output.send({ type: HubFrameType.QueryResult, ...tag, payload: frame.payload });
                if (!this.isCurrent()) return;
                frame.commit();
                this.subscription.lastDataServedAt = new Date().toISOString();
                if (this.request.queryName !== 'QueryHealth.ObserveHealth') this.onChange();
            }
        } catch (error) {
            if (error instanceof ObservableTransportError || this.isCurrent() && !this.output.signal.aborted)
                await this.server.options.logger?.(error, this.context.correlationId);
            if (this.isCurrent() && !this.output.signal.aborted)
                await this.output.send({ type: HubFrameType.Error, ...tag, payload: 'Observable query failed' });
        } finally {
            await this.closeSession(session);
            this.onCompleted();
        }
    }

    private async closeSession(session: ObservableQuerySession): Promise<void> {
        try { await session.close(); }
        catch (error) {
            this.server.recordObservableCleanupFailure(error);
            try { await this.server.options.logger?.(error, this.context.correlationId); }
            catch (loggingError) { this.server.recordObservableCleanupFailure(loggingError); }
        }
    }

    private tag(): { queryId: string; revision?: number } {
        return { queryId: this.subscription.queryId,
            ...(this.subscription.revision === undefined ? {} : { revision: this.subscription.revision }) };
    }
}
