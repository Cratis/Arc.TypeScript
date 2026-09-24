// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext, QueryOptions, QueryResult } from '@cratis/arc.core';
import type { ClassType } from './ScenarioType.js';
import { ScenarioHost } from './ScenarioHost.js';
import { wireRoundTrip } from './wireRoundTrip.js';

/** Runs a decorated static @query method through the real query pipeline. */
export class QueryScenario<T = unknown> {
    readonly #host: ScenarioHost;
    constructor(private readonly model: ClassType, private readonly method: string, ...artifacts: ClassType[]) {
        this.#host = new ScenarioHost([model, ...artifacts]);
    }
    /** Select a static query on a decorated read model. */
    static for<T = unknown>(model: ClassType, method: string, ...artifacts: ClassType[]): QueryScenario<T> {
        return new QueryScenario<T>(model, method, ...artifacts);
    }
    /** Register query dependencies before the first call. */
    get services() { return this.#host.services; }
    /** Default trusted request values for this query. */
    get context() { return this.#host.context; }
    /** Set principal, tenant or correlation values for future calls. */
    withContext(values: Partial<ExecutionContext>): this { this.#host.withContext(values); return this; }
    /** Disable JSON round trips when testing a non-wire object graph deliberately. */
    withSerializationRoundTrip(enabled: boolean): this { this.#host.withSerializationRoundTrip(enabled); return this; }
    /** Execute with named arguments and optional Arc paging/sorting, returning wire-shaped data. */
    async perform(arguments_: Record<string, unknown> = {}, options?: QueryOptions): Promise<QueryResult<T>> {
        const application = await this.#host.application();
        const name = [this.model.name, this.method].join('.');
        const matches = application.server.queries.filter(item => item.name === this.method && item.namespace?.endsWith(this.model.name));
        if (matches.length !== 1) throw new Error(`Unregistered or observable Arc query: ${name}`);
        const operation = matches[0]!;
        const input = this.#host.serializationRoundTrip ? wireRoundTrip(arguments_) : arguments_;
        const result = await application.server.performQuery([operation.namespace, operation.name].filter(Boolean).join('.'), input,
            this.#host.execution(), options) as QueryResult<T>;
        if (this.#host.serializationRoundTrip && result.data !== undefined) return { ...result, data: wireRoundTrip(result.data) as T };
        return result;
    }
    /** Release the owned application and services once. */
    dispose(): Promise<void> { return this.#host.dispose(); }
}
