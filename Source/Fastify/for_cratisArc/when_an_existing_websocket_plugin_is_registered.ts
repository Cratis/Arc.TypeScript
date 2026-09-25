// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { z } from 'zod';
import { cratisArc } from '../index.js';

should();
for (const order of ['before', 'after'] as const) {
    describe(`when a shared WebSocket plugin is registered ${order} Arc`, () => {
        let status: number;
        const app = Fastify();
        const arc = new ArcServer({ queries: [defineQuery({ name: 'Echo', schema: z.object({}), perform: () => 'ok' })] });
        beforeEach(async () => {
            if (order === 'before') await app.register(websocket);
            await app.register(cratisArc, { arc, webSockets: true });
            if (order === 'after') await app.register(websocket);
            status = (await app.inject('/api/echo')).statusCode;
        });
        afterEach(async () => { await app.close(); await arc.dispose(); });
        it('should serve Arc HTTP without a duplicate WebSocket decorator', () => { status.should.equal(200); });
    });
}
