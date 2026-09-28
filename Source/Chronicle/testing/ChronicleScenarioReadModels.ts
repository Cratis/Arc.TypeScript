// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { IEventStore } from '@cratis/chronicle';
import { getEventTypeMetadata } from '@cratis/chronicle/events';
import type { ReadModelScenario, UnsupportedProjectionOperation } from '@cratis/chronicle/testing';
import { getProjectionMetadata } from '@cratis/chronicle/projections';
import { getReducerMetadata } from '@cratis/chronicle/reducers';
import { ChronicleArtifacts } from '../ChronicleArtifacts.js';

type ClassType<T extends object = object> = new () => T;
type TestingModule = Pick<typeof import('@cratis/chronicle/testing'), 'ReadModelScenario'> & {
    UnsupportedProjectionOperation?: typeof UnsupportedProjectionOperation;
};

/** Shared tenant-scoped seed store for in-memory Chronicle command and query scenarios. */
export class ChronicleScenarioReadModels {
    readonly #readModels = new Map<ClassType, Map<string, Map<string, unknown>>>();
    readonly #seeded = new Map<string, Map<string, object[]>>();
    readonly #seedOrder = new Map<string, { sourceId: string; events: object[] }[]>();
    readonly #materialized = new Map<string, Map<ClassType, ReadModelScenario<object>>>();
    readonly #execution = new AsyncLocalStorage<{ unsupportedProjection?: UnsupportedProjectionOperation }>();
    #unsupportedType: typeof UnsupportedProjectionOperation | undefined;
    readonly #catalog = new ChronicleArtifacts();

    constructor(artifacts: ClassType[], private readonly currentTenant: () => string | undefined,
        private readonly loadTesting: () => Promise<TestingModule> = () => import('@cratis/chronicle/testing')) {
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
                    const order = this.#seedOrder.get(resolvedTenant) ?? [];
                    order.push({ sourceId, events });
                    this.#seedOrder.set(resolvedTenant, order);
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

    /** Arc pipelines turn execution errors into results; preserve the SDK's unsupported-projection error for this execution. */
    async runWithProjectionErrors<T>(execute: () => Promise<T>): Promise<T> {
        return this.#execution.run({}, async () => {
            const scope = this.#execution.getStore()!;
            try {
                const result = await execute();
                if (scope.unsupportedProjection) throw scope.unsupportedProjection;
                return result;
            } finally {
                scope.unsupportedProjection = undefined;
            }
        });
    }

    /** Only keyed lookups are available offline; lists and subscriptions require the kernel. */
    forTenant(tenant: string): IEventStore['readModels'] {
        return new Proxy({
            findInstanceById: async (model: ClassType, id: string) => {
                try { return await this.find(model, id, tenant); }
                catch (error) {
                    if (this.#unsupportedType && error instanceof this.#unsupportedType) {
                        const scope = this.#execution.getStore();
                        if (scope) scope.unsupportedProjection = error;
                    }
                    throw error;
                }
            },
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
        const reduced = this.#catalog.reducers.some(type => getReducerMetadata(type)?.readModel === model);
        const explicitlyProjected = this.#catalog.hasProjectionFor(model);
        // Let ReadModelScenario's compiler decide whether a declarative projection without an
        // explicit model resolves to this registered read model; decorators alone cannot tell.
        const inferredCandidate = !reduced && !explicitlyProjected && this.#catalog.readModels.includes(model) &&
            this.#catalog.projections.some(type => getProjectionMetadata(type)?.readModelType === undefined);
        const projected = !reduced && (explicitlyProjected || inferredCandidate);
        if (!reduced && !projected) return null;
        let byType = this.#materialized.get(tenant);
        if (!byType) { byType = new Map(); this.#materialized.set(tenant, byType); }
        let scenario = byType.get(model);
        if (!scenario) {
            const requiredVersion = projected ? '6.19.0' : '6.14';
            let testing: TestingModule;
            try { testing = await this.loadTesting(); }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
                    (error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
                    if (inferredCandidate) return null;
                    throw new Error(`given.forEventSource(...).events requires @cratis/chronicle >= ${requiredVersion}`, { cause: error });
                }
                throw error;
            }
            if (typeof testing.ReadModelScenario !== 'function') {
                if (inferredCandidate) return null;
                throw new Error(`given.forEventSource(...).events requires @cratis/chronicle >= ${requiredVersion}`);
            }
            if (projected && typeof testing.UnsupportedProjectionOperation !== 'function') {
                if (inferredCandidate) return null;
                throw new Error(`Projection-backed read model '${model.name}' requires @cratis/chronicle >= 6.19.0; use ChronicleKernelScenario with an older SDK`);
            }
            if (projected) this.#unsupportedType = testing.UnsupportedProjectionOperation;
            try { scenario = new testing.ReadModelScenario(model, this.#catalog); }
            catch (error) {
                // The SDK compiled the untyped definitions, but none belongs to this model.
                if (inferredCandidate && error instanceof Error &&
                    error.message === `Expected one projection for read model '${model.name}', found 0.`) return null;
                throw error;
            }
            if (projected) {
                for (const { sourceId, events } of this.#seedOrder.get(tenant) ?? []) scenario.given.forEventSource(sourceId).events(...events);
            } else {
                for (const [sourceId, events] of this.#seeded.get(tenant) ?? []) scenario.given.forEventSource(sourceId).events(...events);
            }
            byType.set(model, scenario);
        }
        return scenario.instanceForEventSourceId(id);
    }
}
