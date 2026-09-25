// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { ArcServer, AuthenticationStatus } from '@cratis/arc.core';
import { cratisArc } from '../index.js';
import { given } from '../given.js';

for (const order of ['before', 'after'] as const) {
    class an_arc_host {
        readonly app = Fastify();
        readonly arc = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'test', isAuthenticated: true, roles: [] } })] });
        socket?: WebSocket;
        reader?: ReadableStreamDefaultReader<Uint8Array>;
    }

    describe(`when closing with open hub WebSocket and SSE connections and the WebSocket plugin ${order} Arc`, given(an_arc_host, context => {
        let closed: boolean;
        let status: number;
        let firstEventReceived: boolean;
        let foreignRouteStatus: number;
        beforeEach(async () => {
            if (order === 'before') await context.app.register(websocket);
            await context.app.register(cratisArc, { arc: context.arc, webSockets: true });
            if (order === 'after') await context.app.register(websocket);
            await context.app.listen({ port: 0, host: '127.0.0.1' });
            context.socket = new WebSocket(context.app.listeningOrigin.replace('http:', 'ws:') + '/.cratis/queries/ws');
            await new Promise<void>((resolve, reject) => {
                context.socket!.once('open', resolve);
                context.socket!.once('error', reject);
            });
            const sse = await fetch(context.app.listeningOrigin + '/.cratis/queries/sse');
            status = sse.status;
            context.reader = sse.body!.getReader();
            firstEventReceived = !(await context.reader.read()).done;
            await new Promise<void>((resolve, reject) => {
                const rejected = new WebSocket(context.app.listeningOrigin.replace('http:', 'ws:') + '/not-arc');
                rejected.once('unexpected-response', (request, response) => {
                    foreignRouteStatus = response.statusCode!;
                    response.resume();
                    request.destroy();
                    resolve();
                });
                rejected.once('error', reject);
            });
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([context.app.close(), new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error('Fastify close did not drain observable connections')), 2000);
                })]);
                closed = true;
            } finally { if (timer) clearTimeout(timer); }
        });
        afterEach(async () => {
            context.socket?.terminate();
            await context.reader?.cancel().catch(() => {});
            await context.arc.dispose();
        });
        it('should finish closing the host without client-initiated disconnects', () => {
            status.should.equal(200);
            firstEventReceived.should.equal(true);
            foreignRouteStatus.should.equal(404);
            closed.should.equal(true);
        });
    }));
}
