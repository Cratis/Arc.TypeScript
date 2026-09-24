// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import type { HubConnection } from './HubConnection.js';
import type { QueryHealthSnapshot } from './QueryHealthSnapshot.js';

/** Expose .NET-shaped hub health only for the authenticated caller's own tenant and principal. */
export function buildQueryHealth(connections: readonly HubConnection[], caller: ExecutionContext): QueryHealthSnapshot {
    const visible = connections.filter(connection => caller.principal?.isAuthenticated &&
        connection.context.principal?.id === caller.principal.id && connection.context.tenantId === caller.tenantId);
    const rows = visible.map(connection => ({
        connectionId: connection.id, protocol: connection.protocol, establishedAt: connection.establishedAt,
        subscriptions: connection.subscriptions.map(subscription => ({
            subscriptionId: subscription.queryId, queryIdentifier: subscription.queryName,
            readModelType: subscription.queryName, connectedAt: subscription.connectedAt,
            lastPingSentAt: null, lastPongReceivedAt: null,
            lastDataServedAt: subscription.lastDataServedAt ?? null,
            clientInfo: { remoteIpAddress: null, userAgent: null,
                userId: connection.context.principal!.id, protocol: connection.protocol }
        }))
    }));
    const grouped = new Map<string, QueryHealthSnapshot['querySubscriptions'][number]['subscribers'][number][]>();
    for (const connection of rows) {
        for (const subscription of connection.subscriptions) {
            const subscribers = grouped.get(subscription.queryIdentifier) ?? [];
            subscribers.push({ connectionId: connection.connectionId, protocol: connection.protocol,
                subscriptionId: subscription.subscriptionId, connectedAt: subscription.connectedAt,
                lastPingSentAt: null, lastPongReceivedAt: null,
                lastDataServedAt: subscription.lastDataServedAt, clientInfo: subscription.clientInfo });
            grouped.set(subscription.queryIdentifier, subscribers);
        }
    }
    return {
        connections: rows,
        totalConnections: rows.length,
        totalSubscriptions: rows.reduce((total, row) => total + row.subscriptions.length, 0),
        querySubscriptions: [...grouped].map(([queryName, subscribers]) => ({
            queryName, totalSubscriptions: subscribers.length, subscribers
        }))
    };
}
