// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { EventEmitter } from 'node:events';
import { nodePostgresListener, type NodePostgresClient } from '../../nodePostgresListener.js';

class FakeClient extends EventEmitter {
    connections = 0;
    closes = 0;
    async connect(): Promise<void> { this.connections++; }
    async query(): Promise<{ rows: Record<string, unknown>[] }> { return { rows: [] }; }
    async end(): Promise<void> { this.closes++; this.emit('end'); }
}

describe('when wrapping a dedicated node-postgres client', () => {
    let client: FakeClient;
    beforeEach(() => { client = new FakeClient(); });
    it('should reject pool clients with release()', () => {
        const pooled = Object.assign(client, { release: () => {} });
        (() => nodePostgresListener(pooled)).should.throw('dedicated');
    });
    it('should connect at most once and end idempotently', async () => {
        const listener = nodePostgresListener(client as NodePostgresClient);
        await listener.connect();
        await listener.close(); await listener.close();
        client.connections.should.equal(1);
        client.closes.should.equal(1);
        (() => listener.connect()).should.throw('once');
    });
    it('should keep its error listener registered during shutdown', async () => {
        const listener = nodePostgresListener(client as NodePostgresClient);
        let errors = 0;
        listener.onDisconnect(() => { errors++; });
        await listener.close();
        client.emit('error', new Error('end failure'));
        errors.should.equal(2);
    });
});
