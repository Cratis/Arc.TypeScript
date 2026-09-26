// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import type { ArcApplicationBuilder, ExecutionContext, QueryOptions, QueryResult } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { ChronicleScenarioReadModels } from './ChronicleScenarioReadModels.js';
import '../withChronicle.js';

type ClassType<T extends object = object> = new () => T;

/** Run a snapshot query with tenant-scoped in-memory Chronicle read models, without a kernel. */
export class ChronicleQueryScenario<T = unknown> {
    readonly #scenario: QueryScenario<T>;
    readonly #readModels: ChronicleScenarioReadModels;
    readonly #model: ClassType;
    readonly #method: string;
    private constructor(model: ClassType, method: string, artifacts: ClassType[]) {
        this.#model = model;
        this.#method = method;
        this.#scenario = QueryScenario.for<T>(model, method, ...artifacts);
        this.#readModels = new ChronicleScenarioReadModels([model, ...artifacts], () => this.context.tenantId);
        const stores = new Map<string, IEventStore>();
        const client = { getEventStore: async (_name: string, tenant: string) => {
            let store = stores.get(tenant);
            if (!store) {
                store = { readModels: this.#readModels.forTenant(tenant) } as IEventStore;
                stores.set(tenant, store);
            }
            return store;
        } } as IChronicleClient;
        this.#scenario.extend(builder => { builder.withChronicle({ eventStore: 'InMemoryScenario', client }); });
    }
    /** Select a decorated static snapshot query and register its event, reducer, and read-model artifacts. */
    static for<T = unknown>(model: ClassType, method: string, ...artifacts: ClassType[]): ChronicleQueryScenario<T> {
        return new ChronicleQueryScenario<T>(model, method, artifacts);
    }
    get given() { return this.#readModels.given; }
    get context() { return this.#scenario.context; }
    get services(): Pick<QueryScenario<T>['services'], 'addSingleton' | 'addScoped' | 'addTransient'> { return this.#scenario.services; }
    withContext(values: Partial<ExecutionContext>): this { this.#scenario.withContext(values); return this; }
    withSerializationRoundTrip(enabled: boolean): this { this.#scenario.withSerializationRoundTrip(enabled); return this; }
    extend(install: (builder: ArcApplicationBuilder) => void): this { this.#scenario.extend(install); return this; }
    /** Pin a read model to a source and tenant before performing the query. */
    givenReadModel<R extends object>(type: ClassType<R>, sourceId: string, instance: R, tenant?: string): this {
        this.#readModels.givenReadModel(type, sourceId, instance, tenant);
        return this;
    }
    async perform(arguments_: Record<string, unknown> = {}, options?: QueryOptions): Promise<QueryResult<T>> {
        try { return await this.#scenario.perform(arguments_, options); }
        catch (error) {
            if (error instanceof Error && error.message ===
                `Streaming query ${this.#model.name}.${this.#method} is not supported by QueryScenario; use ObservableQueryScenario`)
                throw new Error(`Streaming query ${this.#model.name}.${this.#method} requires ChronicleKernelScenario for observation`, { cause: error });
            throw error;
        }
    }
    dispose(): Promise<void> { return this.#scenario.dispose(); }
}
