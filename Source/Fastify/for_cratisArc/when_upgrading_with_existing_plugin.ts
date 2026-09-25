// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { ArcServer } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();
for (const order of ['before', 'after'] as const) {
    describe(`when upgrading with a WebSocket plugin registered ${order} Arc`, () => {
        let type: string;
        const app = Fastify();
        const arc = new ArcServer({});
        beforeEach(async () => {
            if (order === 'before') await app.register(websocket);
            await app.register(cratisArc, { arc, webSockets: true });
            if (order === 'after') await app.register(websocket);
            await app.listen({ port: 0, host: '127.0.0.1' });
            const socket = new WebSocket(app.listeningOrigin.replace('http:', 'ws:') + '/.cratis/queries/ws');
            try {
                type = await Promise.race([
                    new Promise<string>((resolve, reject) => {
                        socket.addEventListener('message', event => resolve(JSON.parse(String(event.data)).type), { once: true });
                        socket.addEventListener('error', reject, { once: true });
                    }),
                    new Promise<string>((_resolve, reject) => setTimeout(() => reject(new Error('WebSocket timed out')), 2000))
                ]);
            } finally { socket.close(); }
        });
        afterEach(async () => { await app.close(); await arc.dispose(); });
        it('should accept an observable hub upgrade', () => { type.should.equal('Connected'); });
    });
}
