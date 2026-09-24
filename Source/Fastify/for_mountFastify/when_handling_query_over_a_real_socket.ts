// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { connect } from 'node:net';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { mountFastify } from '../index.js';

should();

describe('when handling QUERY over a real Fastify socket', () => {
    let app: FastifyInstance;
    let arc: ArcServer;
    let query: string;
    let disconnected: boolean;

    beforeEach(async () => {
        let received!: () => void;
        let canceled!: () => void;
        const started = new Promise<void>(resolve => { received = resolve; });
        const aborted = new Promise<void>(resolve => { canceled = resolve; });
        disconnected = false;
        app = Fastify();
        arc = new ArcServer({ queries: [
            defineQuery({ name: 'Read', schema: z.object({ value: z.number() }), perform: ({ value }) => value }),
            defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => new Promise(resolve => {
                context.signal.addEventListener('abort', () => { disconnected = true; canceled(); resolve('aborted'); }, { once: true });
                received();
            }) })
        ] });
        mountFastify(app, arc);
        await app.listen({ host: '127.0.0.1', port: 0 });
        const address = app.server.address();
        if (!address || typeof address === 'string') throw Error('No port');
        const exchange = (text: string): Promise<string> => new Promise((resolve, reject) => {
            const socket = connect(address.port, '127.0.0.1');
            let body = '';
            socket.on('error', reject);
            socket.on('data', data => { body += data.toString(); });
            socket.on('end', () => resolve(body));
            socket.on('connect', () => socket.write(text));
        });
        const payload = '{"arguments":{"value":3}}';
        query = await exchange(`QUERY /api/read HTTP/1.1\r\nHost: x/api/wait?forged\r\nContent-Type: application/vnd.test+json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n${payload}`);
        const socket = connect(address.port, '127.0.0.1');
        socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
        await started;
        socket.destroy();
        await Promise.race([aborted, new Promise<never>((_resolve, reject) => setTimeout(() => reject(Error('Disconnect did not abort')), 2000))]);
    });

    afterEach(async () => { app.server.closeAllConnections(); await app.close(); await arc.dispose(); });

    it('should route the QUERY request', () => { query.should.contain('200 OK'); });
    it('should return the query result', () => { query.should.contain('"data":3'); });
    it('should abort the query after peer disconnect', () => { disconnected.should.be.true; });
});
