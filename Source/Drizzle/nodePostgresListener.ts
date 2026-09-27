// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { PostgreSQLListenerConnection } from './PostgreSQLListenerConnection.js';

/** Experimental structural node-postgres Client contract; pg is required only by applications opting into this adapter. */
export interface NodePostgresClient {
    connect(): Promise<unknown>;
    query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
    end(): Promise<void>;
    on(event: 'notification', listener: (message: { channel: string; payload?: string }) => void): this;
    on(event: 'error' | 'end', listener: (error?: Error) => void): this;
}

/** Experimental: wrap a fresh, dedicated pg Client (not a PoolClient). Arc connects and ends it once. */
export function nodePostgresListener(client: NodePostgresClient): PostgreSQLListenerConnection;
/** Experimental: construct a dedicated pg Client from application-owned configuration. */
export function nodePostgresListener<Configuration>(factory: (config: Configuration) => NodePostgresClient, config: Configuration): PostgreSQLListenerConnection;
export function nodePostgresListener<Configuration>(clientOrFactory: NodePostgresClient | ((config: Configuration) => NodePostgresClient),
    config?: Configuration): PostgreSQLListenerConnection {
    const client = typeof clientOrFactory === 'function' ? clientOrFactory(config as Configuration) : clientOrFactory;
    if (!client || typeof client.connect !== 'function' || typeof client.query !== 'function' ||
        typeof client.end !== 'function' || typeof client.on !== 'function' || 'release' in client)
        throw new Error('PostgreSQL listener requires a dedicated, unconnected pg Client');
    let connected = false;
    let closing: Promise<void> | undefined;
    return {
        connect() {
            if (connected) throw new Error('PostgreSQL listener client can only connect once');
            connected = true;
            return client.connect().then(() => {});
        },
        query(text, values) { return client.query(text, values ? [...values] : undefined); },
        onNotification(listener) { client.on('notification', message => listener(message.channel, message.payload)); },
        onDisconnect(listener) {
            client.on('error', listener);
            client.on('end', listener);
        },
        close() { return closing ??= client.end(); }
    };
}
