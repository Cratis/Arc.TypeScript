// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import type { ShutdownTransaction } from '../../dependencyInjection/ShutdownTransaction.js';
import type { WebSocketTransport } from './WebSocketTransport.js';

interface UpgradedSocket {
    readonly transport: WebSocketTransport;
    readonly completion: Promise<void>;
}
const upgraded = new WeakMap<ArcServer, Set<UpgradedSocket>>();
const closedState = 3;

/** @internal Track a host-upgraded socket until its protocol work settles. */
export function trackUpgradedSocket(arc: ArcServer, transport: WebSocketTransport, completion: Promise<void>): void {
    const sockets = upgraded.get(arc) ?? new Set<UpgradedSocket>();
    upgraded.set(arc, sockets);
    const socket = { transport, completion };
    sockets.add(socket);
    const release = (): void => { sockets.delete(socket); };
    void completion.then(release, release);
}

/** @internal Close host-upgraded transports before participant stop and join their protocol work afterwards. */
export function coordinateUpgradedSockets(arc: ArcServer, transaction: ShutdownTransaction): void {
    const active = [...upgraded.get(arc) ?? []];
    if (!active.length) return;
    const closed = active.map(({ transport }) => new Promise<void>(resolve => {
        if (transport.socket.readyState === closedState) resolve();
        else transport.socket.on('close', () => resolve());
        transport.close();
    }));
    transaction.release((async () => {
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            for (const { transport } of active) transport.socket.terminate();
        }, arc.observableLimits.shutdownTimeoutMs);
        try { await Promise.all(closed); }
        finally { clearTimeout(timer); }
        if (timedOut) throw new Error('Arc WebSocket shutdown timed out');
    })());
    transaction.work(async () => {
        const outcomes = await Promise.allSettled(active.map(({ completion }) => completion));
        const failures = outcomes.filter(outcome => outcome.status === 'rejected').map(outcome => outcome.reason);
        if (failures.length) throw new AggregateError(failures, 'Arc WebSocket shutdown failed');
    });
}
