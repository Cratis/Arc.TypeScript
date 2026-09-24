// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { it, should } from 'vitest';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import express from 'express';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery } from '@cratis/arc.core';
import { mountExpress } from '../../index.js';

should();

it('does not normalize foreign paths into privileged Arc routes or trust malformed Host', async () => {
    let handled = 0;
    const app = express();
    mountExpress(app, new ArcServer({ commands: [defineCommand({ name: 'Delete', path: '/api/admin/delete', schema: z.object({}), handle: () => ++handled })] }));
    app.get('/health', (_request, response) => response.end('healthy'));
    const http = createServer(app);
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    try {
        const address = http.address();
        if (!address || typeof address === 'string') throw Error('No port');
        const send = async (path: string, method: string, host: string): Promise<string> => new Promise((resolve, reject) => {
            const socket = connect(address.port, '127.0.0.1');
            let text = '';
            socket.on('error', reject);
            socket.on('data', chunk => { text += chunk.toString(); });
            socket.on('end', () => resolve(text));
            socket.on('connect', () => socket.write(`${method} ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\nContent-Length: 2\r\n\r\n{}`));
        });
        for (const path of ['//api/admin/delete', '/api/../api/admin/delete', '/api/%2e%2e/api/admin/delete'])
            (await send(path, 'POST', 'malformed:host:garbage')).should.not.contain('"response":1');
        (handled).should.equal(0);
        (await send('/health', 'GET', 'malformed:host:garbage')).should.contain('healthy');
        (await send('/api/admin/delete', 'POST', 'malformed:host:garbage')).should.contain('"response":1');
    } finally { await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve())); }
});

it('aborts the context signal on a real peer disconnect', async () => {
    let received!: () => void;
    let disconnected!: () => void;
    const started = new Promise<void>(resolve => { received = resolve; });
    const aborted = new Promise<void>(resolve => { disconnected = resolve; });
    const app = express();
    mountExpress(app, new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => new Promise(resolve => {
        context.signal.addEventListener('abort', () => { disconnected(); resolve('disconnected'); }, { once: true });
        received();
    }) })] }));
    const http = createServer(app);
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    try {
        const address = http.address();
        if (!address || typeof address === 'string') throw Error('No port');
        const socket = connect(address.port, '127.0.0.1');
        socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
        await started;
        socket.destroy();
        await Promise.race([aborted, new Promise<never>((_resolve, reject) => setTimeout(() => reject(Error('Disconnect did not abort')), 2000))]);
    } finally { http.closeAllConnections(); await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve())); }
});
