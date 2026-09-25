// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { createServer, type Server } from 'node:http';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import WebSocket from 'ws';
import { ArcServer, AuthenticationStatus } from '@cratis/arc.core';
import { cratisArc } from '../index.js';
import { given } from '../given.js';

should();
class a_caller_owned_hono_listener {
    readonly app = new Hono();
    readonly arc = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
        principal: { id: 'test', isAuthenticated: true, roles: [] } })] });
}
describe('when injecting Arc WebSockets into a caller-owned Hono listener', given(a_caller_owned_hono_listener, context => {
    let connected = false;
    beforeEach(async () => {
        const middleware = cratisArc(context.arc);
        context.app.use(middleware);
        const listener = serve({ fetch: context.app.fetch, hostname: '127.0.0.1', port: 0, createServer }) as Server;
        await new Promise<void>((resolve, reject) => { listener.once('listening', resolve); listener.once('error', reject); });
        const disposeSockets = middleware.injectWebSocket(listener);
        try {
            const address = listener.address();
            if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
            const socket = new WebSocket(`ws://127.0.0.1:${address.port}/.cratis/queries/ws`);
            await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
            connected = true;
            await disposeSockets();
        } finally {
            const closed = new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
            listener.closeAllConnections();
            await closed;
            await context.arc.dispose();
        }
    });
    it('should accept a hub upgrade', () => { connected.should.equal(true); });
}));
