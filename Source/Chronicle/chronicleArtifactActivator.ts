// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { normalizeCorrelationId, Severity } from '@cratis/arc.core';
import type { ArcServer, ExecutionContext, ServiceRegistry, ShutdownParticipant } from '@cratis/arc.core';
import { ArtifactDelivery } from '@cratis/chronicle/artifacts';
import type { ActivatedArtifact, ArtifactActivationContext, ArtifactInvocationContext, ClientArtifactsActivator } from '@cratis/chronicle/artifacts';
import type { Constructor } from '@cratis/fundamentals';
import { bindDeliveryStore } from './ChronicleStores.js';

/** A Chronicle artifact activator that also takes part in Arc's coordinated shutdown. */
export type ChronicleArtifactActivator = ClientArtifactsActivator & ShutdownParticipant;

const eventsDelivery = ArtifactDelivery.Events;
const expectedEventStores = new WeakMap<object, string>();

/** @internal The event store an activator created by {@link chronicleArtifactActivator} accepts, if the value is one. */
export function chronicleArtifactActivatorEventStore(value: unknown): string | undefined {
    return typeof value === 'function' ? expectedEventStores.get(value) : undefined;
}

/**
 * Activate Chronicle reactors and reducers in an Arc service scope, one scope per delivery.
 *
 * Each activation validates that it belongs to the expected event store, derives the tenant from the observation's
 * namespace, resolves the artifact from a fresh scope, runs every handler in that scope with the handled event's
 * correlation, and disposes the scope when the SDK completes the lease. A scope cleanup failure fails the delivery.
 * Arc's Chronicle services resolved in the scope use the delivered event store rather than the runtime's client.
 * The activator registers itself as a shutdown participant of the server's registry on first use: shutdown stops
 * admission, cancels active leases, and waits for every admitted lease to settle before services are disposed.
 * @param server - Resolves the built Arc server.
 * @param expectedEventStore - The only event store whose observations this activator accepts.
 */
export function chronicleArtifactActivator(server: () => ArcServer, expectedEventStore: string): ChronicleArtifactActivator {
    if (typeof expectedEventStore !== 'string' || !expectedEventStore) throw new Error('An expected Chronicle event store is required');
    const shutdown = new AbortController();
    const active = new Set<Promise<void>>();
    const participating = new WeakSet<ServiceRegistry>();

    const activate = async <T>(type: Constructor<T>, context: ArtifactActivationContext): Promise<ActivatedArtifact<T>> => {
        if (shutdown.signal.aborted) throw new Error('Chronicle artifact activation has stopped');
        const selected = server();
        const services = selected.services;
        if (!participating.has(services)) {
            services.addShutdownParticipant(activator);
            participating.add(services);
        }
        const store = context.eventStore.name.value;
        if (store !== expectedEventStore)
            throw new Error(`Chronicle ${context.kind} ${context.artifactId} observes event store ${store}, not ${expectedEventStore}`);
        if (context.readModels !== context.eventStore.readModels)
            throw new Error(`Chronicle ${context.kind} ${context.artifactId} read models do not belong to event store ${store}`);
        const identity: ExecutionContext = Object.freeze({
            principal: undefined,
            tenantId: context.eventStore.namespace.value,
            correlationId: context.delivery === eventsDelivery
                ? normalizeCorrelationId(context.eventContext.correlationId)
                : crypto.randomUUID(),
            signal: AbortSignal.any([context.signal, shutdown.signal]),
            allowedSeverity: Severity.Warning
        });

        let settle!: () => void;
        const lifetime = new Promise<void>(resolve => { settle = resolve; });
        active.add(lifetime);
        void lifetime.then(() => active.delete(lifetime));
        let cleanup: Promise<void> | undefined;
        let scope;
        try { scope = services.createScope(identity); }
        catch (error) { settle(); throw error; }
        const created = scope;
        // Arc's Chronicle services in this scope, and in scopes of commands the reactor returns, use the delivered store.
        bindDeliveryStore(identity.signal, services, context.eventStore);
        // Shared by complete() and dispose() so scoped services are disposed exactly once.
        const release = (): Promise<void> => cleanup ??= created.dispose().finally(settle);

        let instance: T;
        try { instance = await selected.runInScope(created, () => created.resolve(type)); }
        catch (error) {
            try { await release(); }
            catch (cleanupError) {
                throw new AggregateError([error, cleanupError], `Activating ${type.name} failed and its services could not be released`,
                    { cause: cleanupError });
            }
            throw error;
        }
        let completed = false;
        return {
            instance,
            run: <R>(callback: () => R | Promise<R>, invocation?: ArtifactInvocationContext) => {
                // Chronicle 6.16 runs event handlers without invocation metadata; each event's correlation would be lost.
                if (context.delivery === eventsDelivery && invocation?.delivery !== eventsDelivery)
                    throw new Error(`Chronicle ${context.kind} ${context.artifactId} ran an event handler without its event; scoped activation requires @cratis/chronicle 6.17.0 or later`);
                return selected.runInScope(created, callback, invocation?.delivery === eventsDelivery
                    ? { correlationId: normalizeCorrelationId(invocation.eventContext.correlationId) } : undefined);
            },
            complete: () => { completed = true; return release(); },
            // Completion already reported any cleanup failure; a fallback dispose releases without repeating it.
            dispose: () => completed ? undefined : release()
        };
    };

    const activator = Object.assign(activate as ClientArtifactsActivator, {
        stop(): void { shutdown.abort(new Error('Chronicle artifact activation has stopped')); },
        async drain(): Promise<void> {
            while (active.size) await Promise.allSettled([...active]);
        }
    });
    expectedEventStores.set(activator, expectedEventStore);
    return activator;
}
