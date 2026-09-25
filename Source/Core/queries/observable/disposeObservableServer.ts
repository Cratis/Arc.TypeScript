// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import type { ObservableQueryHub } from './ObservableQueryHub.js';
import type { ObservableSessions } from './ObservableSessions.js';

/** Drain observable connections before disposing server-owned services. */
export async function disposeObservableServer(hub: ObservableQueryHub, sessions: ObservableSessions,
    closeWebSockets: (() => Promise<void>) | undefined, services: ServiceRegistry, ownsServices: boolean): Promise<void> {
    sessions.markDisposed();
    const activeHubConnections = hub.connections.length;
    const hubClosing = hub.dispose();
    const closing = closeWebSockets?.();
    const open = sessions.sessions;
    if (!open.length && !closing && !activeHubConnections) {
        if (ownsServices) await services.dispose();
        return;
    }
    const failures: unknown[] = [];
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
    if (ownsServices) {
        try { await services.dispose(); }
        catch (error) { failures.push(error); }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, 'Observable query shutdown failed');
}
