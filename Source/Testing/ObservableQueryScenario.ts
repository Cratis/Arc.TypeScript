// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext, QueryOptions, QueryResult } from '@cratis/arc.core';
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
    /** Disable JSON round trips for an intentional object-only check. */
    withSerializationRoundTrip(enabled: boolean): this { this.#host.withSerializationRoundTrip(enabled); return this; }
    /** Wait for exactly the requested number of emissions, failing at the deadline rather than sleeping. */
    async collect(maximumEmissions: number, timeoutMs = 5_000, arguments_: Record<string, unknown> = {},
        options?: QueryOptions): Promise<ObservableScenarioResult<T>> {
        if (!Number.isSafeInteger(maximumEmissions) || maximumEmissions <= 0 || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
            throw new Error('Emission count and timeout must be positive integers');
        const application = await this.#host.application();
        const matches = application.server.queries.filter(item => item.name === this.method && item.namespace?.endsWith(this.model.name));
        if (matches.length !== 1 || !('observable' in matches[0]!))
            throw new Error(`Unregistered observable Arc query: ${this.model.name}.${this.method}`);
        const operation = matches[0]!;
        const input = this.#host.serializationRoundTrip ? wireRoundTrip(arguments_) : arguments_;
        const session = await application.server.openObservableQuery([operation.namespace, operation.name].filter(Boolean).join('.'),
            input, this.#host.execution(), options);
        try {
            if (session.rejection) return { rejection: session.rejection, emissions: [] };
            const emissions: QueryResult<T>[] = [];
            const iterator = session.results();
            let timer: ReturnType<typeof setTimeout> | undefined;
            const deadline = new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error(`Timed out waiting for ${maximumEmissions} observable emissions`)), timeoutMs);
            });
            try {
                for (let index = 0; index < maximumEmissions; index++) {
                    const next = await Promise.race([iterator.next(), deadline]);
                    if (next.done) break;
                    const result = next.value as QueryResult<T>;
                    emissions.push(this.#host.serializationRoundTrip && result.data !== undefined
                        ? { ...result, data: wireRoundTrip(result.data) as T } : result);
                }
            } finally { if (timer) clearTimeout(timer); }
            return { emissions };
        } finally { await session.close(); }
    }
    /** Release the owned application and active subscriptions once. */
    dispose(): Promise<void> { return this.#host.dispose(); }
}
