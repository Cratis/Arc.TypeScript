// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../ExecutionContext.js';
import type { QueryOptions } from '../../QueryOptions.js';
import type { QueryResult } from '../../QueryResult.js';
import { queryResult } from '../../results.js';
import { requestContext } from '../../RequestContextStore.js';
import type { ServiceRegistry } from '../../ServiceRegistry.js';
import { withServices } from '../../ServiceScope.js';
import type { ObservableOperation } from './ObservableOperation.js';
import type { ObservableSource } from './ObservableSource.js';
import { toEmissions } from './toEmissions.js';
import { ObservableEmissionDecision } from './ObservableEmissionDecision.js';
import type { ObservableEmissionGuard } from './ObservableEmissionGuard.js';
import type { ServiceToken } from '../../ServiceToken.js';

/** An opened pipeline and scope owned by one live subscription (or snapshot request). */
export class ObservableQuerySession {
    readonly #controller = new AbortController();
    readonly #context: ExecutionContext;
    readonly #scope;
    #source: ObservableSource<unknown> | undefined;
    #result: QueryResult | undefined;
    #closed: Promise<void> | undefined;

    private constructor(
        readonly operation: ObservableOperation,
        readonly input: unknown,
        readonly options: QueryOptions | undefined,
        readonly services: ServiceRegistry,
        readonly guards: readonly ServiceToken<ObservableEmissionGuard>[],
        context: ExecutionContext,
        readonly onClose: () => void
    ) {
        this.#context = Object.freeze({ ...context, signal: AbortSignal.any([context.signal, this.#controller.signal]) });
        this.#scope = services.createScope(this.#context);
    }

    /** Open the producer only after the actual query pipeline authorizes and validates the caller. */
    static async open(operation: ObservableOperation, input: unknown, context: ExecutionContext, options: QueryOptions | undefined,
        services: ServiceRegistry, guards: readonly ServiceToken<ObservableEmissionGuard>[], onClose: () => void): Promise<ObservableQuerySession> {
        const session = new ObservableQuerySession(operation, input, options, services, guards, context, onClose);
        try {
            const result = await session.run(() => operation.run(input, session.#context) as Promise<QueryResult<ObservableSource<unknown>>>);
            session.#result = result;
            if (result.isSuccess) session.#source = result.data;
            else await session.close();
            return session;
        } catch (error) {
            await session.close();
            throw error;
        }
    }

    /** The initial authorization/validation outcome, if it failed. */
    get rejection(): QueryResult | undefined { return this.#result?.isSuccess ? undefined : this.#result; }

    /** Read a current value without subscribing or waiting for an emission. */
    async current(): Promise<QueryResult | undefined> {
        if (!this.#source?.current) return undefined;
        const snapshot = this.#source.current();
        if (!snapshot.hasValue) return undefined;
        const result = await this.run(() => this.operation.render(this.input, this.#context, this.options, snapshot.value));
        return this.guarded(result);
    }

    /** Cancel the producer and dispose the subscription scope exactly once. */
    close(): Promise<void> {
        if (this.#closed) return this.#closed;
        this.#controller.abort();
        this.#closed = this.#scope.dispose().finally(this.onClose);
        return this.#closed;
    }

    /** Stream results in order, rendering each snapshot through the query pipeline. */
    async *results(): AsyncGenerator<QueryResult> {
        try {
            if (this.rejection) { yield this.rejection; return; }
            if (!this.#source) throw new Error('Observable query source was not initialized');
            for await (const value of toEmissions(this.#source, this.#context.signal)) {
                const result = await this.run(() => this.operation.render(this.input, this.#context, this.options, value));
                const guarded = await this.guarded(result);
                if (!guarded) continue;
                yield guarded;
                if (!guarded.isAuthorized || guarded.hasExceptions || !guarded.isValid) return;
            }
        } catch (error) {
            if (!this.#context.signal.aborted) yield queryResult(this.#context, { exceptionMessages: [String(error)] });
        } finally {
            await this.close();
        }
    }

    private async guarded(result: QueryResult): Promise<QueryResult | undefined> {
        if (!result.isSuccess || !this.guards.length) return result;
        try {
            const decision = await this.run(async () => {
                this.#scope.registry.preflight(this.guards);
                let mostRestrictive = ObservableEmissionDecision.Allow;
                for (const token of this.guards) {
                    const policy = await this.#scope.resolve(token);
                    const identity = Object.freeze({ ...this.#context,
                        principal: this.#context.principal ? structuredClone(this.#context.principal) : undefined });
                    const outcome = await policy.check(structuredClone(this.input), structuredClone(result.data), identity);
                    if (outcome === ObservableEmissionDecision.DenyAndTerminate) return outcome;
                    if (outcome === ObservableEmissionDecision.Suppress) mostRestrictive = outcome;
                    else if (outcome !== ObservableEmissionDecision.Allow) throw new Error('Invalid observable emission decision');
                }
                return mostRestrictive;
            });
            if (decision === ObservableEmissionDecision.Allow) return result;
            if (decision === ObservableEmissionDecision.Suppress) return undefined;
        } catch {
            // An unknown guard result, resolution failure or thrown policy must never publish data.
        }
        return queryResult(this.#context, { isAuthorized: false });
    }

    private run<T>(callback: () => Promise<T>): Promise<T> {
        return this.services.runExecution(() => requestContext.run(this.#context, () => withServices(this.#scope, callback)));
    }
}
