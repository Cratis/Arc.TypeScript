// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import type { QueryResult } from '../QueryResult.js';
import { hasFailure, originalFailure } from '../../execution/failureTracking.js';
import { queryResult } from '../../results/index.js';
import { requestContext } from '../../execution/RequestContextStore.js';
import { withServices } from '../../dependencyInjection/ServiceScope.js';
import type { ObservableSource } from './ObservableSource.js';
import { toEmissions } from './toEmissions.js';
import { ObservableEmissionDecision } from './ObservableEmissionDecision.js';
import type { ObservableEmissionContext } from './ObservableEmissionContext.js';
import type { ObservableSessionConfig } from './ObservableSessionConfig.js';
import { clonePrincipal } from './clonePrincipal.js';
import { beginSubscription, observe } from '../../execution/observability.js';

/** An opened pipeline and scope owned by one live subscription (or snapshot request). */
export class ObservableQuerySession {
    readonly #controller = new AbortController();
    readonly #context: ExecutionContext;
    readonly #scope;
    readonly #subscription: ReturnType<typeof beginSubscription>;
    #source: ObservableSource<unknown> | undefined;
    #result: QueryResult | undefined;
    #activeIterator: AsyncGenerator<QueryResult> | undefined;
    #streamOpened = false;
    #firstEmissionDelivered = false;
    #closed: Promise<void> | undefined;
    #scopeClosed: Promise<void> | undefined;
    #terminalFailure: unknown;
    #released = false;

    private constructor(private readonly config: ObservableSessionConfig) {
        this.#context = Object.freeze({ ...config.context, principal: clonePrincipal(config.context.principal),
            signal: AbortSignal.any([config.context.signal, this.#controller.signal]) });
        this.#scope = config.services.createScope(this.#context);
        this.#subscription = beginSubscription(
            config.operation.fullyQualifiedName, this.#context.correlationId);
    }

    /** Open the producer only after the actual query pipeline authorizes and validates the caller. */
    static async open(config: ObservableSessionConfig): Promise<ObservableQuerySession> {
        const session = new ObservableQuerySession(config);
        try {
            const start = (): Promise<QueryResult<ObservableSource<unknown>>> =>
                config.operation.run(config.input, session.#context, config.options) as Promise<QueryResult<ObservableSource<unknown>>>;
            const result = await session.run(() => observe('cratis.arc.query.perform', session.#context.correlationId,
                { query_name: config.operation.fullyQualifiedName }, start, undefined, result => result.hasExceptions));
            session.#result = result;
            await session.reportResult(result);
            if (result.isSuccess) session.#source = result.data;
            else await session.close();
            return session;
        } catch (error) {
            await session.close();
            throw error;
        }
    }

    /** Initial authorization/validation outcome, if it failed. */
    get rejection(): QueryResult | undefined { return this.#result?.isSuccess ? undefined : this.#result; }

    /** Read a current value without opening an emission iterator. */
    async current(): Promise<QueryResult | undefined> {
        const source = this.#source;
        if (!source) return undefined;
        let present = false;
        let value: unknown;
        if (source.current) {
            const snapshot = await source.current();
            present = snapshot.hasValue;
            if (snapshot.hasValue) value = snapshot.value;
        } else if ('getValue' in source && typeof source.getValue === 'function') {
            present = true;
            value = source.getValue();
        } else if ('value' in source) {
            present = true;
            value = source.value;
        }
        if (!present) return undefined;
        const result = await this.run(() => observe('cratis.arc.query.emission', this.#context.correlationId,
            { query_name: this.config.operation.fullyQualifiedName }, () => this.config.operation.render(this.config.input,
                this.#context, this.config.options, value), undefined, result => result.hasExceptions));
        await this.reportResult(result);
        return this.guarded(result);
    }

    /** Cancel the producer, release its iterator, and dispose the scope exactly once. */
    close(): Promise<void> {
        if (this.#closed) return this.#closed;
        this.#controller.abort();
        this.releaseAdmission();
        this.#closed = (async () => {
            const failures: unknown[] = [];
            if (this.#activeIterator) {
                try { await this.#activeIterator.return(undefined); }
                catch (error) { failures.push(error); }
            }
            try { await this.closeScope(); }
            catch (error) { failures.push(error); }
            if (this.#terminalFailure) failures.push(this.#terminalFailure);
            if (failures.length) throw new AggregateError(failures, 'Observable subscription cleanup failed');
        })();
        return this.#closed;
    }

    /** Report a transport or serialization failure through the configured server logger. */
    reportTransportFailure(error: unknown): Promise<void> { return this.config.reportFailure(error); }

    /** A subscription has exactly one consumer; subsequent calls cannot open another source. */
    results(): AsyncGenerator<QueryResult> {
        if (this.#streamOpened) throw new Error('Observable query results already consumed');
        this.#streamOpened = true;
        const iterator = this.streamResults();
        this.#activeIterator = iterator;
        return iterator;
    }

    private async *streamResults(): AsyncGenerator<QueryResult> {
        try {
            if (this.rejection) { yield this.redact(this.rejection); return; }
            if (!this.#source) throw new Error('Observable query source was not initialized');
            for await (const value of toEmissions(this.#source, this.#context.signal, this.config.pendingEmissions)) {
                const result = await this.run(() => observe('cratis.arc.query.emission', this.#context.correlationId,
                    { query_name: this.config.operation.fullyQualifiedName }, () => this.config.operation.render(this.config.input,
                        this.#context, this.config.options, value), undefined, result => result.hasExceptions));
                await this.reportResult(result);
                const guarded = await this.guarded(result);
                if (!guarded) continue;
                yield this.redact(guarded);
                if (guarded.isSuccess) this.#firstEmissionDelivered = true;
                if (!guarded.isAuthorized || guarded.hasExceptions || !guarded.isValid) return;
            }
        } catch (error) {
            if (this.#context.signal.aborted) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                this.#terminalFailure = error;
                throw error;
            }
            await this.config.reportFailure(error);
            yield queryResult(this.#context, { exceptionMessages: [this.config.exposeExceptionDetails
                ? String(error) : 'An unexpected error occurred'] });
        } finally { await this.closeScope(); }
    }

    private releaseAdmission(): void {
        if (this.#released) return;
        this.#released = true;
        this.config.onRelease();
    }

    private closeScope(): Promise<void> {
        if (this.#scopeClosed) return this.#scopeClosed;
        this.releaseAdmission();
        this.#scopeClosed = this.#scope.dispose().finally(() => {
            try { this.#subscription.end(); }
            finally { this.config.onClose(); }
        });
        return this.#scopeClosed;
    }

    private async reportResult(result: QueryResult): Promise<void> {
        if (hasFailure(result)) await this.config.reportFailure(originalFailure(result));
    }

    private redact(result: QueryResult): QueryResult {
        return this.config.exposeExceptionDetails || !result.hasExceptions ? result : {
            ...result, exceptionMessages: ['An unexpected error occurred'], exceptionStackTrace: ''
        };
    }

    private async guarded(result: QueryResult): Promise<QueryResult | undefined> {
        if (!result.isSuccess || !this.config.guards.length) return result;
        try {
            const decision = await this.run(async () => {
                this.#scope.registry.preflight(this.config.guards);
                let mostRestrictive = ObservableEmissionDecision.Allow;
                const identity = Object.freeze({ ...this.#context,
                    principal: clonePrincipal(this.#context.principal) });
                const emission: ObservableEmissionContext = Object.freeze({
                    queryName: this.config.operation.fullyQualifiedName,
                    input: structuredClone(this.config.input), data: structuredClone(result.data),
                    context: identity, isFirstEmission: !this.#firstEmissionDelivered, signal: this.#context.signal
                });
                for (const token of this.config.guards) {
                    const policy = await this.#scope.resolve(token);
                    const outcome = await policy.check(emission);
                    if (outcome === ObservableEmissionDecision.DenyAndTerminate) return outcome;
                    if (outcome === ObservableEmissionDecision.Suppress) mostRestrictive = outcome;
                    else if (outcome !== ObservableEmissionDecision.Allow) throw new Error('Invalid observable emission decision');
                }
                return mostRestrictive;
            });
            if (decision === ObservableEmissionDecision.Allow) return result;
            if (decision === ObservableEmissionDecision.Suppress) return undefined;
            await this.config.reportFailure(new Error('Observable emission denied by policy'));
        } catch (error) { await this.config.reportFailure(error); }
        return queryResult(this.#context, { isAuthorized: false });
    }

    private run<T>(callback: () => Promise<T>): Promise<T> {
        return this.config.services.runExecution(() => requestContext.run(this.#context,
            () => withServices(this.#scope, () => this.#subscription.run(callback))));
    }
}
