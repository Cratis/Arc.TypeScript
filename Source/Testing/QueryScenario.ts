// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { encodeWireValue, snapshotStreamSource, type ArcApplicationBuilder, type ExecutionContext, type QueryOptions, type QueryResult } from '@cratis/arc.core';
import type { ClassType } from './ScenarioType.js';
import { ScenarioHost } from './ScenarioHost.js';
import { wireRoundTrip } from './wireRoundTrip.js';

async function releaseSnapshotStream(source: object, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    const disposable = source as { [Symbol.asyncDispose]?: () => PromiseLike<void>; [Symbol.dispose]?: () => void;
        unsubscribe?: () => void | PromiseLike<void>; dispose?: () => void | PromiseLike<void>;
        [Symbol.asyncIterator]?: () => AsyncIterator<unknown> };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    try {
        let release: () => unknown;
        if (typeof disposable[Symbol.asyncDispose] === 'function') release = () => disposable[Symbol.asyncDispose]!();
        else if (typeof disposable[Symbol.dispose] === 'function') release = () => disposable[Symbol.dispose]!();
        else if (typeof disposable.unsubscribe === 'function') release = () => disposable.unsubscribe!();
        else if (typeof disposable.dispose === 'function') release = () => disposable.dispose!();
        else if (typeof disposable[Symbol.asyncIterator] === 'function') release = () => disposable[Symbol.asyncIterator]!().return?.() ?? undefined;
        else return;
        await Promise.race([
            Promise.resolve().then(() => { if (!signal.aborted) return release(); }),
            new Promise<void>(resolve => { timer = setTimeout(resolve, 1_000); }),
            new Promise<void>(resolve => {
                cancel = resolve;
                signal.addEventListener('abort', cancel, { once: true });
                if (signal.aborted) resolve();
            })
        ]);
    } catch { /* Preserve the snapshot boundary error if scenario-owned cleanup fails. */ }
    finally {
        if (timer) clearTimeout(timer);
        if (cancel) signal.removeEventListener('abort', cancel);
    }
}

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
    /** Install generated metadata or another integration before the first call. */
    extend(install: (builder: ArcApplicationBuilder) => void): this { this.#host.extend(install); return this; }
    /** Register query dependencies before the first call. */
    get services() { return this.#host.services; }
    /** Default trusted request values for this query. */
    get context() { return this.#host.context; }
    /** Set principal, tenant or correlation values for future calls. */
    withContext(values: Partial<ExecutionContext>): this { this.#host.withContext(values); return this; }
    /** Skip JSON stringify/parse while still encoding Arc wire values. */
    withSerializationRoundTrip(enabled: boolean): this { this.#host.withSerializationRoundTrip(enabled); return this; }
    /** Execute with named arguments and optional Arc paging/sorting, returning wire-shaped data. */
    async perform(arguments_: Record<string, unknown> = {}, options?: QueryOptions): Promise<QueryResult<T>> {
        const application = await this.#host.application();
        const name = [this.model.name, this.method].join('.');
        const matches = application.server.queries.filter(item => item.name === this.method && (item.namespace === this.model.name || item.namespace?.endsWith(`.${this.model.name}`)));
        if (matches.length !== 1) throw new Error(`Unregistered or ambiguous Arc query: ${name}`);
        const operation = matches[0]!;
        if ('observable' in operation && operation.observable === true)
            throw new Error(`Streaming query ${name} is not supported by QueryScenario; use ObservableQueryScenario`);
        const input = this.#host.serializationRoundTrip ? wireRoundTrip(arguments_) : encodeWireValue(arguments_);
        const execution = this.#host.execution();
        const result = await application.server.performQuery([operation.namespace, operation.name].filter(Boolean).join('.'), input,
            execution, options) as QueryResult<T>;
        const source = snapshotStreamSource(result);
        if (source) await releaseSnapshotStream(source, execution.signal);
        if (this.#host.serializationRoundTrip && result.data !== undefined) return { ...result, data: wireRoundTrip(result.data) as T };
        return result;
    }
    /** Release the owned application and services once. */
    dispose(): Promise<void> { return this.#host.dispose(); }
}
