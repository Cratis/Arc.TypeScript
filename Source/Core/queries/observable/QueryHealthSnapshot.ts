// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Caller-scoped connection health; client IP and unrelated principals are never exposed. */
export interface QueryHealthSnapshot {
    readonly connections: readonly {
        connectionId: string;
        protocol: string;
        establishedAt: string;
        subscriptions: readonly {
            subscriptionId: string;
            queryIdentifier: string;
            readModelType: string;
            connectedAt: string;
            lastPingSentAt: null;
            lastPongReceivedAt: null;
            lastDataServedAt: string | null;
            clientInfo: { remoteIpAddress: null; userAgent: null; userId: string; protocol: string };
        }[];
    }[];
    readonly totalConnections: number;
    readonly totalSubscriptions: number;
    readonly querySubscriptions: readonly {
        queryName: string;
        totalSubscriptions: number;
        subscribers: readonly { connectionId: string; protocol: string; subscriptionId: string;
            connectedAt: string; lastPingSentAt: null; lastPongReceivedAt: null;
            lastDataServedAt: string | null; clientInfo: { remoteIpAddress: null; userAgent: null; userId: string; protocol: string } }[];
    }[];
}
