// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '@cratis/arc.core';
import { MongoClient } from 'mongodb';
import type { MongoDBOptions } from './MongoDBOptions.js';

/** Owns URI-created clients only; never closes a caller-supplied client. */
export class MongoClientFactory {
    readonly #clients = new Map<string, MongoClient>();
    constructor(private readonly options: MongoDBOptions) {
        if (Number(!!options.client) + Number(!!options.server) + Number(!!options.serverResolver) !== 1)
            throw new Error('MongoDB requires exactly one of client, server, or serverResolver');
    }
    /** Get a client for the execution's trusted tenant. */
    get(context: ExecutionContext): MongoClient {
        if (this.options.client) return this.options.client;
        if (!context.tenantId) throw new Error('A tenant is required for MongoDB access');
        const uri = this.options.serverResolver?.(context.tenantId, context) ?? this.options.server;
        if (!uri) throw new Error('MongoDB server resolver returned no server');
        let client = this.#clients.get(uri);
        if (!client) { client = new MongoClient(uri); this.#clients.set(uri, client); }
        return client;
    }
    async [Symbol.asyncDispose](): Promise<void> {
        await Promise.all([...this.#clients.values()].map(client => client.close()));
        this.#clients.clear();
    }
}
