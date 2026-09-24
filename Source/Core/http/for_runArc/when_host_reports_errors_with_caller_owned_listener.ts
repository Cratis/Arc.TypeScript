// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { createArcNodeHandler } from '../createArcNodeHandler.js';
import { runArc } from '../runArc.js';
import { exchange, portOf } from './given/a_node_host.js';

should();

describe('when a host reports errors alongside a caller-owned listener', () => {
    let errors: unknown[];
    let nativeStatus: number;
    let ownedStatus: number;
    let ownedTrace: number;
    let connectStatus: string;

    beforeEach(async () => {
        errors = [];
        const arc = new ArcServer({ logger: error => { errors.push(error); },
            queries: [defineQuery({ name: 'Ping', schema: z.object({}), perform: () => 'pong' })] });
        const host = await runArc(arc, { port: 0, native: () => { throw Error('native failed'); } });
        const owned = createServer(createArcNodeHandler(arc));
        await new Promise<void>(resolve => owned.listen(0, '127.0.0.1', resolve));
        try {
            host.server.emit('error', Error('accept failed'));
            nativeStatus = (await exchange(portOf(host.server), '/api/ping')).status;
            ownedStatus = (await exchange(portOf(owned), '/api/ping')).status;
            ownedTrace = (await exchange(portOf(owned), '/api/ping', 'TRACE')).status;
            const connection = connect(portOf(host.server), '127.0.0.1');
            try {
                connectStatus = await new Promise<string>((resolve, reject) => {
                    connection.once('connect', () => connection.write('CONNECT /api/ping HTTP/1.1\r\nHost: localhost\r\n\r\n'));
                    connection.once('data', chunk => resolve(String(chunk).split('\r\n')[0]!));
                    connection.once('error', reject);
                });
            } finally { connection.destroy(); }
        } finally {
            await host.close();
            await new Promise<void>((resolve, reject) => owned.close(error => error ? reject(error) : resolve()));
            await arc.dispose();
        }
    });

    it('should log listener errors', () => {
        errors.some(error => error instanceof Error && error.message === 'accept failed').should.equal(true);
    });
    it('should contain native callback failures', () => { nativeStatus.should.equal(500); });
    it('should log the native callback failure', () => {
        errors.some(error => error instanceof Error && error.message === 'native failed').should.equal(true);
    });
    it('should serve caller-owned listeners independently', () => { ownedStatus.should.equal(200); });
    it('should reject TRACE on a caller-owned listener', () => { ownedTrace.should.equal(405); });
    it('should reject CONNECT over the real listener', () => { connectStatus.should.equal('HTTP/1.1 405 Method Not Allowed'); });
});
