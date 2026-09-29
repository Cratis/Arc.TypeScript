// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentServices } from '@cratis/arc.core';
import type { ExecutionContext, ServiceRegistry, ServiceScope } from '@cratis/arc.core';
import type { IEventStore } from '@cratis/chronicle';
import type { ChronicleArtifacts } from './ChronicleArtifacts.js';
import type { ChronicleRegistration } from './ChronicleOptions.js';

/** Where Arc's Chronicle services get the event store for an execution. ChronicleRuntime is one. */
export interface ChronicleStoreSource {
    readonly options: ChronicleRegistration;
    readonly artifacts: ChronicleArtifacts;
    /** Resolve the event store for the execution's tenant. */
    getStore(context: ExecutionContext): Promise<IEventStore>;
}

interface DeliveryBinding {
    readonly registry: ServiceRegistry;
    readonly tenantId: string;
    readonly store: IEventStore;
}

// Keyed by the delivery scope's signal, which returned commands also run with, so their scopes find the same store.
const deliveries = new WeakMap<AbortSignal, DeliveryBinding>();

/** @internal Pin Arc scopes of this registry that run with the delivery's signal to the store the SDK delivered from. */
export function bindDeliveryStore(signal: AbortSignal, registry: ServiceRegistry, store: IEventStore): void {
    deliveries.set(signal, { registry, tenantId: store.namespace.value, store });
}

function bindingFor(scope: ServiceScope): DeliveryBinding | undefined {
    const identity = scope.identity;
    const binding = identity && deliveries.get(identity.signal);
    if (!binding) return undefined;
    if (binding.registry !== scope.registry || identity.tenantId !== binding.tenantId)
        throw new Error(`Chronicle delivery for ${binding.store.name.value}/${binding.tenantId} does not belong to this Arc scope`);
    return binding;
}

/**
 * @internal The signal of the Chronicle delivery the caller runs in, validated against the registry, event store and
 * namespace, or undefined outside a scoped delivery.
 */
export function currentDeliverySignal(registry: ServiceRegistry, eventStore: string, namespace: string): AbortSignal | undefined {
    let scope: ServiceScope;
    try { scope = currentServices(); }
    catch { return undefined; }
    const binding = bindingFor(scope);
    if (!binding) return undefined;
    if (binding.registry !== registry || binding.store.name.value !== eventStore || binding.tenantId !== namespace)
        throw new Error(`Reactor commands for ${eventStore}/${namespace} do not match their Chronicle delivery`);
    return scope.identity!.signal;
}

/**
 * @internal Store access for one Arc scope: the delivery's own store while handling a Chronicle delivery or running
 * the commands a reactor returned, otherwise the runtime's store for the execution's tenant. Resolves lazily.
 */
export class ChronicleScopedStore implements ChronicleStoreSource {
    readonly #source: ChronicleStoreSource;
    readonly #delivery: DeliveryBinding | undefined;
    constructor(source: ChronicleStoreSource, scope: ServiceScope) {
        this.#source = source;
        this.#delivery = bindingFor(scope);
    }
    get options(): ChronicleRegistration { return this.#source.options; }
    get artifacts(): ChronicleArtifacts { return this.#source.artifacts; }
    async getStore(context: ExecutionContext): Promise<IEventStore> {
        const delivery = this.#delivery;
        if (!delivery) return this.#source.getStore(context);
        // Fail closed rather than fall back to the runtime's client.
        if (delivery.store.name.value !== this.#source.options.eventStore || context.tenantId !== delivery.tenantId)
            throw new Error(`Chronicle delivery for ${delivery.store.name.value}/${delivery.tenantId} cannot serve ` +
                `${this.#source.options.eventStore}/${context.tenantId ?? 'the default namespace'}`);
        return delivery.store;
    }
}
