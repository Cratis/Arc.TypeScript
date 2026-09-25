// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Hono } from 'hono';
import { ArcServer, AuthenticationStatus } from '@cratis/arc.core';
import { cratisArc, serveCratisArc } from '../index.js';
import { given } from '../given.js';

class a_hono_host {
    readonly app = new Hono();
    readonly arc = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
        principal: { id: 'test', isAuthenticated: true, roles: [] } })] });
    reader?: ReadableStreamDefaultReader<Uint8Array>;
}
describe('when closing a Hono host with an open SSE connection', given(a_hono_host, context => {
    let closed: boolean;
    let status: number;
    let firstEventReceived: boolean;
    beforeEach(async () => {
        context.app.use(cratisArc(context.arc));
        const hosted = await serveCratisArc(context.app, context.arc, { port: 0, hostname: '127.0.0.1' });
        try {
            const address = hosted.server.address();
            if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
            const response = await fetch(`http://127.0.0.1:${address.port}/.cratis/queries/sse`);
            status = response.status;
            context.reader = response.body!.getReader();
            firstEventReceived = !(await context.reader.read()).done;
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([hosted.dispose(), new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error('Hono host did not drain SSE')), 2000);
                })]);
                closed = true;
            } finally { if (timer) clearTimeout(timer); }
        } finally { await context.arc.dispose(); }
    });
    afterEach(async () => { await context.reader?.cancel().catch(() => {}); });
    it('should finish without waiting for the client to disconnect', () => {
        status.should.equal(200);
        firstEventReceived.should.equal(true);
        closed.should.equal(true);
    });
}));
