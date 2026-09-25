// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express from 'express';
import WebSocket from 'ws';
import { ArcServer, AuthenticationStatus } from '@cratis/arc.core';
import { cratisArc } from '../index.js';
import { given } from '../given.js';

class an_express_host {
    readonly app = express();
    readonly arc = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
        principal: { id: 'test', isAuthenticated: true, roles: [] } })] });
    reader?: ReadableStreamDefaultReader<Uint8Array>;
    socket?: WebSocket;
}
describe('when closing Express with an open SSE connection', given(an_express_host, context => {
    let closed: boolean;
    let status: number;
    let firstEventReceived: boolean;
    let socketWasOpen: boolean;
    beforeEach(async () => {
        const middleware = cratisArc(context.arc);
        context.app.use(middleware);
        const listener = context.app.listen(0, '127.0.0.1');
        await new Promise<void>(resolve => listener.once('listening', resolve));
        middleware.injectWebSocket(listener);
        try {
            const address = listener.address();
            if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
            context.socket = new WebSocket(`ws://127.0.0.1:${address.port}/.cratis/queries/ws`);
            await new Promise<void>((resolve, reject) => {
                context.socket!.once('open', resolve);
                context.socket!.once('error', reject);
            });
            socketWasOpen = context.socket.readyState === WebSocket.OPEN;
            const response = await fetch(`http://127.0.0.1:${address.port}/.cratis/queries/sse`);
            status = response.status;
            context.reader = response.body!.getReader();
            firstEventReceived = !(await context.reader.read()).done;
            await middleware.close(listener);
            closed = true;
        } finally { await context.arc.dispose(); }
    });
    afterEach(async () => {
        context.socket?.terminate();
        await context.reader?.cancel().catch(() => {});
    });
    it('should drain both active connections before clients disconnect', () => {
        status.should.equal(200);
        firstEventReceived.should.equal(true);
        socketWasOpen.should.equal(true);
        closed.should.equal(true);
    });
}));
