// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { createServer, type Server } from 'node:http';
import { connect } from 'node:net';
import express from 'express';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { mountExpress } from '../index.js';

should();

describe('when an Express peer disconnects', () => {
    let http: Server;
    let arc: ArcServer;
    let canceled: boolean;

    beforeEach(async () => {
        let received!: () => void;
        let disconnected!: () => void;
        const started = new Promise<void>(resolve => { received = resolve; });
        const aborted = new Promise<void>(resolve => { disconnected = resolve; });
        canceled = false;
        const app = express();
        arc = new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => new Promise(resolve => {
            context.signal.addEventListener('abort', () => { canceled = true; disconnected(); resolve('disconnected'); }, { once: true });
            received();
        }) })] });
        mountExpress(app, arc);
        http = createServer(app);
        await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
        const address = http.address();
        if (!address || typeof address === 'string') throw Error('No port');
        const socket = connect(address.port, '127.0.0.1');
        socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
        await started;
        socket.destroy();
        await Promise.race([aborted, new Promise<never>((_resolve, reject) => setTimeout(() => reject(Error('Disconnect did not abort')), 2000))]);
    });

    afterEach(async () => {
        http.closeAllConnections();
        await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
        await arc.dispose();
    });

    it('should abort the query context', () => { canceled.should.equal(true); });
});
