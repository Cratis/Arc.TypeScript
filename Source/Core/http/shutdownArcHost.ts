// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../ArcServer.js';
import type { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';

/** Close a host and its Arc resources in shutdown-phase order. A borrowed registry requires an explicit owner handoff. */
export async function shutdownArcHost(server: ArcServer, closeListener: () => Promise<void>,
    registry?: ServiceRegistry): Promise<void> {
    if (registry && registry !== server.services) throw new Error('Shutdown registry does not belong to this Arc server');
    if (!server.ownsServices && !registry && server.services.hasShutdownParticipants)
        throw new Error('Coordinated shutdown requires the caller-owned service registry');
    const failures: unknown[] = [];
    const capture = async (task: Promise<void>): Promise<void> => {
        try { await task; } catch (error) { failures.push(error); }
    };
    const invoke = (action: () => Promise<void>): Promise<void> => {
        try { return action(); } catch (error) { return Promise.reject(error); }
    };
    if (server.services.hasShutdownParticipants) {
        // Registry disposal freezes admission synchronously, before listener closure can abort a session.
        const services = registry ? invoke(() => registry.dispose()) : invoke(() => server.dispose());
        const listener = invoke(closeListener);
        await Promise.all([capture(services), capture(listener)]);
        if (registry) await capture(invoke(() => server.dispose()));
    } else {
        // Retain the original host-first, transport-first path when there are no participants.
        await capture(invoke(closeListener));
        await capture(invoke(() => server.dispose()));
        if (registry) await capture(invoke(() => registry.dispose()));
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, 'Arc application shutdown failed');
}
