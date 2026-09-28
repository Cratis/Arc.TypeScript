// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import type { ObservableQueryHub } from './ObservableQueryHub.js';
import type { ObservableSessions } from './ObservableSessions.js';

/** Drain observable connections before disposing server-owned services. */
export async function disposeObservableServer(hub: ObservableQueryHub, sessions: ObservableSessions,
    closeWebSockets: (() => Promise<void>) | undefined, services: ServiceRegistry, ownsServices: boolean,
    onTransportClosing?: (closing: Promise<void>) => void, closeSessions = true): Promise<void> {
    sessions.markDisposed();
    const activeHubConnections = hub.connections.length;
    const hubClosing = hub.dispose(!closeSessions);
    let closing: Promise<void> | undefined;
    try { closing = closeWebSockets?.(); }
    catch (error) { closing = Promise.reject(error); }
    const open = closeSessions ? sessions.sessions : [];
    if (!open.length && !closing && !activeHubConnections) {
        onTransportClosing?.(Promise.resolve());
        if (ownsServices) await services.dispose();
        return;
    }
    const failures: unknown[] = [];
    const transport = (async () => {
        if (activeHubConnections) {
            try { await hubClosing; }
            catch (error) { failures.push(error); }
        }
        if (closing) {
            try { await closing; }
            catch (error) { failures.push(error); }
        }
        const outcomes = await Promise.allSettled(open.map(session => session.close()));
        failures.push(...outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason as unknown));
        if (failures.length === 1) throw failures[0];
        if (failures.length) throw new AggregateError(failures, 'Observable query shutdown failed');
    })();
    onTransportClosing?.(transport);
    let transportFailure: unknown;
    let transportRejected = false;
    try { await transport; }
    catch (error) { transportFailure = error; transportRejected = true; }
    if (ownsServices) {
        try { await services.dispose(); }
        catch (error) {
            // The registry cleanup hook joins this same transport promise. Account for its
            // leaves once by provenance, even when a leaf is a primitive also thrown elsewhere.
            const leaves = (failure: unknown): unknown[] => failure instanceof AggregateError && failure.errors.length
                ? failure.errors.flatMap(leaves) : [failure];
            const joined = onTransportClosing && transportRejected ? leaves(transportFailure) : [];
            const seenAggregates = new Set<AggregateError>();
            const collect = (failure: unknown): void => {
                if (failure instanceof AggregateError && failure.errors.length) {
                    if (seenAggregates.has(failure)) return;
                    seenAggregates.add(failure);
                    if (failures.includes(failure)) {
                        for (const leaf of leaves(failure)) {
                            const index = joined.findIndex(value => Object.is(value, leaf));
                            if (index !== -1) joined.splice(index, 1);
                        }
                        return;
                    }
                    for (const nested of failure.errors) collect(nested);
                    return;
                }
                const index = joined.findIndex(value => Object.is(value, failure));
                if (index !== -1) { joined.splice(index, 1); return; }
                const reference = failure !== null && (typeof failure === 'object' || typeof failure === 'function');
                if (!reference || !failures.includes(failure)) failures.push(failure);
            };
            if (failures.length) collect(error);
            else failures.push(error);
        }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, 'Observable query shutdown failed');
}
