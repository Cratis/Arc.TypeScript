// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArcServer } from '../../ArcServer.js';
import { runArc } from '../runArc.js';
import { eventually, exchange, portOf } from './given/a_node_host.js';

should();

describe('when a peer disconnects during static transfer', () => {
    let bytes: number;
    let headStatus: number;

    beforeEach(async () => {
        const root = await mkdtemp(join(tmpdir(), 'arc-node-'));
        await writeFile(join(root, 'large.bin'), Buffer.alloc(16 * 1024 * 1024, 97));
        const arc = new ArcServer({});
        const host = await runArc(arc, { port: 0, staticFiles: { root } });
        const socket = connect(portOf(host.server), '127.0.0.1');
        try {
            bytes = 0;
            await new Promise<void>(resolve => {
                socket.once('connect', () => socket.write('GET /large.bin HTTP/1.1\r\nHost: localhost\r\n\r\n'));
                socket.once('data', chunk => { bytes += chunk.length; socket.destroy(); resolve(); });
            });
            await eventually(() => socket.destroyed);
            headStatus = (await exchange(portOf(host.server), '/large.bin', 'HEAD')).status;
        } finally { socket.destroy(); await host.close(); await arc.dispose(); await rm(root, { recursive: true, force: true }); }
    });

    it('should disconnect before transferring the entire file', () => { (bytes < 16 * 1024 * 1024).should.equal(true); });
    it('should remain available after releasing the stream', () => { headStatus.should.equal(200); });
});
