// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IEventStore } from '@cratis/chronicle';
import { getEventTypeMetadata } from '@cratis/chronicle/events';
import type { ReadModelScenario } from '@cratis/chronicle/testing';
import { getReducerMetadata } from '@cratis/chronicle/reducers';
import { ChronicleArtifacts } from '../ChronicleArtifacts.js';

type ClassType<T extends object = object> = new () => T;

/** Shared tenant-scoped seed store for in-memory Chronicle command and query scenarios. */
export class ChronicleScenarioReadModels {
    readonly #readModels = new Map<ClassType, Map<string, Map<string, unknown>>>();
    readonly #seeded = new Map<string, Map<string, object[]>>();
    readonly #materialized = new Map<string, Map<ClassType, ReadModelScenario<object>>>();
    readonly #catalog = new ChronicleArtifacts();

    constructor(artifacts: ClassType[], private readonly currentTenant: () => string | undefined) {
        for (const artifact of artifacts) this.#catalog.register(artifact);
    }

    get given() {
        return {
            forEventSource: (sourceId: string, tenant?: string) => ({
                events: (...events: object[]): void => {
                    const resolvedTenant = tenant ?? this.currentTenant() ?? 'Default';
                    const history = this.#seeded.get(resolvedTenant) ?? new Map<string, object[]>();
                    const source = history.get(sourceId) ?? [];
                    for (const event of events) {
                        if (!this.#catalog.eventTypes.includes(event.constructor as ClassType) || !getEventTypeMetadata(event.constructor))
                            throw new Error(`In-memory Chronicle cannot seed an unregistered event: ${event.constructor.name}`);
                    }
                    source.push(...events);
                    history.set(sourceId, source);
                    this.#seeded.set(resolvedTenant, history);
                    this.#materialized.delete(resolvedTenant);
                },
                readModel: <R extends object>(instance: R): void => {
                    this.givenReadModel(instance.constructor as ClassType<R>, sourceId, instance, tenant);
                }
            })
        };
    }

    givenReadModel<R extends object>(type: ClassType<R>, sourceId: string, instance: R, tenant?: string): void {
        tenant ??= this.currentTenant() ?? 'Default';
        const tenants = this.#readModels.get(type) ?? new Map<string, Map<string, unknown>>();
        const values = tenants.get(tenant) ?? new Map<string, unknown>();
        values.set(sourceId, instance);
        tenants.set(tenant, values);
        this.#readModels.set(type, tenants);
    }

    /** Only keyed lookups are available offline; lists and subscriptions require the kernel. */
    forTenant(tenant: string): IEventStore['readModels'] {
        return new Proxy({
            findInstanceById: async (model: ClassType, id: string) => this.find(model, id, tenant),
            getInstances: async () => { throw new Error('In-memory Chronicle cannot list read models; use ChronicleKernelScenario'); },
            watch: () => { throw new Error('In-memory Chronicle cannot watch read models; use ChronicleKernelScenario'); }
        }, { get: (target, property: string | symbol) => {
            if (property in target) return Reflect.get(target, property);
            if (typeof property === 'symbol' || property === 'then') return undefined;
            return () => { throw new Error(`In-memory Chronicle cannot ${property} read models; use ChronicleKernelScenario`); };
        } }) as unknown as IEventStore['readModels'];
    }

    private async find(model: ClassType, id: string, tenant: string): Promise<unknown> {
        const pinned = this.#readModels.get(model)?.get(tenant)?.get(id);
        if (pinned !== undefined) return pinned;
        if (!this.#seeded.get(tenant)?.get(id)?.length) return null;
        if (!this.#catalog.reducers.some(type => getReducerMetadata(type)?.readModel === model)) {
            if (this.#catalog.hasProjectionFor(model))
                throw new Error(`Projection-backed read model '${model.name}' is not supported yet; use a kernel-backed test. Use ChronicleKernelScenario for projections.`);
            return null;
        }
        let byType = this.#materialized.get(tenant);
        if (!byType) { byType = new Map(); this.#materialized.set(tenant, byType); }
        let scenario = byType.get(model);
        if (!scenario) {
            let Scenario: typeof ReadModelScenario;
            try { ({ ReadModelScenario: Scenario } = await import('@cratis/chronicle/testing')); }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
                    (error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND')
                    throw new Error('given.forEventSource(...).events requires @cratis/chronicle >= 6.14', { cause: error });
                throw error;
            }
            if (typeof Scenario !== 'function')
                throw new Error('given.forEventSource(...).events requires @cratis/chronicle >= 6.14');
            scenario = new Scenario(model, this.#catalog);
            for (const [sourceId, events] of this.#seeded.get(tenant) ?? []) scenario.given.forEventSource(sourceId).events(...events);
            byType.set(model, scenario);
        }
        return scenario.instanceForEventSourceId(id);
    }
}
