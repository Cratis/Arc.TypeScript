// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { it, should } from 'vitest';
import Fastify from 'fastify';
import { connect } from 'node:net';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery } from '@cratis/arc.core';
import { mountFastify } from '../../index.js';

should();

it('routes only the matched path, regardless of a crafted Host header', async () => {
    let deletes = 0;
    const app = Fastify();
    mountFastify(app, new ArcServer({ commands: [defineCommand({ name: 'Delete', path: '/api/admin/delete', schema: z.object({}), handle: () => ++deletes })] }));
    try {
        const foreign = await app.inject({ method: 'POST', url: '/api/admin/delete', headers: { host: 'x/api/admin/delete?ignored' }, payload: '{}' });
        (foreign.statusCode).should.equal(200);
        (deletes).should.equal(1);
        const other = await app.inject({ method: 'POST', url: '/api/admin/delete/validate', headers: { host: 'x/api/admin/delete?ignored' }, payload: '{}' });
        (other.statusCode).should.equal(200);
        (deletes).should.equal(1);
    } finally { await app.close(); }
});

it('retains malformed UTF8 with and without content-length and accepts vendor JSON', async () => {
    const app = Fastify();
    mountFastify(app, new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: input => input.value })] }));
    try {
        for (const headers of [{ 'content-type': 'application/json' }, { 'content-type': 'application/json', 'content-length': '1' }]) {
            const result = await app.inject({ method: 'POST', url: '/api/echo', headers, payload: Buffer.from([0xff]) });
            (result.statusCode).should.equal(400);
            (result.json().validationResults[0].reason).should.equal('malformedRequest');
        }
        const vendor = await app.inject({ method: 'POST', url: '/api/echo', headers: { 'content-type': 'application/vnd.test+json' }, payload: '{"value":"hi"}' });
        (vendor.statusCode).should.equal(200);
        (vendor.json().response).should.equal('hi');
        const unsupported = await app.inject({ method: 'PATCH', url: '/api/echo', payload: '{}' });
        (unsupported.statusCode).should.equal(405);
        should().equal(unsupported.headers.allow, 'POST');
    } finally { await app.close(); }
});

it('handles QUERY over a real socket and aborts on peer disconnect', async () => {
    let received!: () => void;
    let disconnected!: () => void;
    const started = new Promise<void>(resolve => { received = resolve; });
    const aborted = new Promise<void>(resolve => { disconnected = resolve; });
    const app = Fastify();
    mountFastify(app, new ArcServer({ queries: [
        defineQuery({ name: 'Read', schema: z.object({ value: z.number() }), perform: ({ value }) => value }),
        defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => new Promise(resolve => {
            context.signal.addEventListener('abort', () => { disconnected(); resolve('aborted'); }, { once: true });
            received();
        }) })
    ] }));
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
        const address = app.server.address();
        if (!address || typeof address === 'string') throw Error('No port');
        const exchange = (text: string): Promise<string> => new Promise((resolve, reject) => {
            const socket = connect(address.port, '127.0.0.1');
            let receivedText = '';
            socket.on('error', reject);
            socket.on('data', data => { receivedText += data.toString(); });
            socket.on('end', () => resolve(receivedText));
            socket.on('connect', () => socket.write(text));
        });
        const payload = '{"arguments":{"value":3}}';
        const query = await exchange(`QUERY /api/read HTTP/1.1\r\nHost: x/api/wait?forged\r\nContent-Type: application/vnd.test+json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n${payload}`);
        (query).should.contain('200 OK');
        (query).should.contain('"data":3');
        const socket = connect(address.port, '127.0.0.1');
        socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
        await started;
        socket.destroy();
        await Promise.race([aborted, new Promise<never>((_resolve, reject) => setTimeout(() => reject(Error('Disconnect did not abort')), 2000))]);
    } finally { app.server.closeAllConnections(); await app.close(); }
});

it('does not change parent content parsers for unrelated application routes', async () => {
    const app = Fastify();
    app.post('/foreign', request => ({ parsed: request.body }));
    mountFastify(app, new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({}), handle: () => 1 })] }));
    try {
        const response = await app.inject({ method: 'POST', url: '/foreign', payload: { value: 1 } });
        (response.json()).should.deep.equal({ parsed: { value: 1 } });
    } finally { await app.close(); }
});
