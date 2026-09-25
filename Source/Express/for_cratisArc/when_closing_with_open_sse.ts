// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import express from 'express';
import { ArcServer, AuthenticationStatus } from '@cratis/arc.core';
import { cratisArc } from '../index.js';
import { given } from '../given.js';

should();
class an_express_host {
    readonly app = express();
    readonly arc = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
        principal: { id: 'test', isAuthenticated: true, roles: [] } })] });
    reader?: ReadableStreamDefaultReader<Uint8Array>;
}
describe('when closing Express with an open SSE connection', given(an_express_host, context => {
    let closed: boolean;
    beforeEach(async () => {
        const middleware = cratisArc(context.arc);
        context.app.use(middleware);
        const listener = context.app.listen(0, '127.0.0.1');
        await new Promise<void>(resolve => listener.once('listening', resolve));
        const disposeSockets = middleware.injectWebSocket(listener);
        try {
            const address = listener.address();
            if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
            const response = await fetch(`http://127.0.0.1:${address.port}/.cratis/queries/sse`);
            response.status.should.equal(200);
            context.reader = response.body!.getReader();
            (await context.reader.read()).done.should.equal(false);
            await disposeSockets();
            const stopped = new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
            listener.closeAllConnections();
            await stopped;
            closed = true;
        } finally { await context.arc.dispose(); }
    });
    afterEach(async () => { await context.reader?.cancel().catch(() => {}); });
    it('should finish shutdown before the client disconnects', () => { closed.should.equal(true); });
}));
