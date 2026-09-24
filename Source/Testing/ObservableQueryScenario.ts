// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { encodeWireValue, type ExecutionContext, type QueryOptions, type QueryResult } from '@cratis/arc.core';
import type { ClassType } from './ScenarioType.js';
import { ScenarioHost } from './ScenarioHost.js';
import { wireRoundTrip } from './wireRoundTrip.js';
import type { ObservableScenarioResult } from './ObservableScenarioResult.js';

/** Collects explicitly bounded emissions from a real decorated observable query. */
export class ObservableQueryScenario<T = unknown> {
    readonly #host: ScenarioHost;
    constructor(private readonly model: ClassType, private readonly method: string, ...artifacts: ClassType[]) {
        this.#host = new ScenarioHost([model, ...artifacts]);
    }
    /** Select a static observable query on a decorated read model. */
    static for<T = unknown>(model: ClassType, method: string, ...artifacts: ClassType[]): ObservableQueryScenario<T> {
        return new ObservableQueryScenario<T>(model, method, ...artifacts);
    }
    /** Register query dependencies before the first subscription. */
    get services() { return this.#host.services; }
    /** Default trusted request values for this subscription. */
    get context() { return this.#host.context; }
    /** Set principal, tenant or correlation values for future subscriptions. */
    withContext(values: Partial<ExecutionContext>): this { this.#host.withContext(values); return this; }
    /** Skip JSON stringify/parse while still encoding Arc wire values. */
    withSerializationRoundTrip(enabled: boolean): this { this.#host.withSerializationRoundTrip(enabled); return this; }
    /** Collect up to the requested number of emissions; finite streams may complete sooner. */
    async collect(maximumEmissions: number, timeoutMs = 5_000, arguments_: Record<string, unknown> = {},
        options?: QueryOptions): Promise<ObservableScenarioResult<T>> {
        if (!Number.isSafeInteger(maximumEmissions) || maximumEmissions <= 0 || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
            throw new Error('Emission count and timeout must be positive integers');
        const timeout = AbortSignal.timeout(timeoutMs);
        const message = `Timed out waiting for ${maximumEmissions} observable emissions`;
        const deadline = new Promise<never>((_resolve, reject) => {
            timeout.addEventListener('abort', () => reject(new Error(message)), { once: true });
        });
        const application = await Promise.race([this.#host.application(), deadline]);
        const matches = application.server.queries.filter(item => item.name === this.method &&
            (item.namespace === this.model.name || item.namespace?.endsWith(`.${this.model.name}`)));
        if (matches.length !== 1 || !('observable' in matches[0]!))
            throw new Error(`Unregistered observable Arc query: ${this.model.name}.${this.method}`);
        const operation = matches[0]!;
        const input = this.#host.serializationRoundTrip ? wireRoundTrip(arguments_) : encodeWireValue(arguments_);
        const opening = application.server.openObservableQuery([operation.namespace, operation.name].filter(Boolean).join('.'),
            input, this.#host.execution(timeout), options);
        // A non-cooperative producer can finish opening after the deadline. Close that session too.
        const session = await Promise.race([opening.then(async opened => {
            if (timeout.aborted) await opened.close();
            return opened;
        }), deadline]);
        try {
            if (session.rejection) return { rejection: session.rejection, emissions: [], completed: false };
            const emissions: QueryResult<T>[] = [];
            const iterator = session.results();
            for (let index = 0; index < maximumEmissions; index++) {
                const next = await Promise.race([iterator.next(), deadline]);
                if (next.done) return { emissions, completed: true };
                const result = next.value as QueryResult<T>;
                emissions.push(this.#host.serializationRoundTrip && result.data !== undefined
                    ? { ...result, data: wireRoundTrip(result.data) as T } : result);
            }
            return { emissions, completed: false };
        } finally { await session.close(); }
    }
    /** Release the owned application and active subscriptions once. */
    dispose(): Promise<void> { return this.#host.dispose(); }
}
