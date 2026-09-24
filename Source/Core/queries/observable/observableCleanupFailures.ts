// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import type { ObservableSessions } from '../ObservableSessions.js';

const owners = new WeakMap<ArcServer, ObservableSessions>();

/** Keep cleanup diagnostics inside the transport, not on the ArcServer API. */
export function registerObservableCleanup(server: ArcServer, sessions: ObservableSessions): void {
    owners.set(server, sessions);
}

export function recordObservableCleanupFailure(server: ArcServer, session: object): boolean {
    const owner = owners.get(server);
    if (!owner) throw new Error('Observable cleanup owner is unavailable');
    return owner.recordCleanupFailure(session);
}
