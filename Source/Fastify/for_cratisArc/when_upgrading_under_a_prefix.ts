// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify from 'fastify';
import { ArcServer } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();
describe('when upgrading under a host prefix', () => {
    const app = Fastify();
    const arc = new ArcServer({});
    let type: string;
    beforeEach(async () => {
        await app.register(cratisArc, { arc, prefix: '/v1', webSockets: true });
        await app.listen({ port: 0, host: '127.0.0.1' });
        const socket = new WebSocket(app.listeningOrigin.replace('http:', 'ws:') + '/v1/.cratis/queries/ws');
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
    it('should accept the prefixed hub upgrade', () => { type.should.equal('Connected'); });
});
