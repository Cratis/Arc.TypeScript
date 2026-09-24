// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { createServer, type Server } from 'node:http';
import { connect } from 'node:net';
import express from 'express';
import { z } from 'zod';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { mountExpress } from '../index.js';

should();

describe('when routing with a malformed Host header', () => {
    let http: Server;
    let arc: ArcServer;
    let bypasses: string[];
    let handled: number;
    let health: string;
    let command: string;

    beforeEach(async () => {
        handled = 0;
        const app = express();
        arc = new ArcServer({ commands: [defineCommand({ name: 'Delete', path: '/api/admin/delete', schema: z.object({}), handle: () => ++handled })] });
        mountExpress(app, arc);
        app.get('/health', (_request, response) => response.end('healthy'));
        http = createServer(app);
        await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
        const address = http.address();
        if (!address || typeof address === 'string') throw Error('No port');
        const send = async (path: string, method: string): Promise<string> => new Promise((resolve, reject) => {
            const socket = connect(address.port, '127.0.0.1');
            let text = '';
            socket.on('error', reject);
            socket.on('data', chunk => { text += chunk.toString(); });
            socket.on('end', () => resolve(text));
            socket.on('connect', () => socket.write(`${method} ${path} HTTP/1.1\r\nHost: malformed:host:garbage\r\nConnection: close\r\nContent-Length: 2\r\n\r\n{}`));
        });
        bypasses = await Promise.all(['//api/admin/delete', '/api/../api/admin/delete', '/api/%2e%2e/api/admin/delete'].map(path => send(path, 'POST')));
        health = await send('/health', 'GET');
        command = await send('/api/admin/delete', 'POST');
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
        await arc.dispose();
    });

    it('should not normalize foreign paths into the privileged route', () => {
        for (const response of bypasses) response.should.not.contain('"response":1');
    });
    it('should invoke the privileged route only once', () => { handled.should.equal(1); });
    it('should leave foreign routes accessible', () => { health.should.contain('healthy'); });
    it('should serve the exact privileged path', () => { command.should.contain('"response":1'); });
});
