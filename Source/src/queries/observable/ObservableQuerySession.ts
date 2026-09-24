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
        context: ExecutionContext,
        readonly onClose: () => void
    ) {
        this.#context = Object.freeze({ ...context, signal: AbortSignal.any([context.signal, this.#controller.signal]) });
        this.#scope = services.createScope(this.#context);
    }

    /** Open the producer only after the actual query pipeline authorizes and validates the caller. */
    static async open(operation: ObservableOperation, input: unknown, context: ExecutionContext, options: QueryOptions | undefined,
        services: ServiceRegistry, onClose: () => void): Promise<ObservableQuerySession> {
        const session = new ObservableQuerySession(operation, input, options, services, context, onClose);
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
        return this.run(() => this.operation.render(this.input, this.#context, this.options, snapshot.value));
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
                yield result;
                if (!result.isAuthorized || result.hasExceptions || !result.isValid) return;
            }
        } catch (error) {
            if (!this.#context.signal.aborted) yield queryResult(this.#context, { exceptionMessages: [String(error)] });
        } finally {
            await this.close();
        }
    }

    private run<T>(callback: () => Promise<T>): Promise<T> {
        return this.services.runExecution(() => requestContext.run(this.#context, () => withServices(this.#scope, callback)));
    }
}
