// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Experimental dedicated PostgreSQL session owned by Arc; never use a pooled query client. */
export interface PostgreSQLListenerConnection {
    connect(): Promise<void>;
    query(text: string, values?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
    onNotification(listener: (channel: string, payload: string | undefined) => void): void;
    onDisconnect(listener: (error?: Error) => void): void;
    close(): Promise<void>;
}
