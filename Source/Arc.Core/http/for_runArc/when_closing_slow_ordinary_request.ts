// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { connect } from 'node:net';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { runArc } from '../runArc.js';
import { eventually, portOf } from './given/a_node_host.js';

should();

describe('when closing with a slow ordinary request', () => {
    let destroyed: boolean;

    beforeEach(async () => {
        let entered!: () => void;
        const ready = new Promise<void>(resolve => { entered = resolve; });
        const arc = new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => {
            entered();
            return new Promise<string>(resolve => context.signal.addEventListener('abort', () => resolve('done'), { once: true }));
        } })] });
        const host = await runArc(arc, { port: 0 });
        const socket = connect(portOf(host.server), '127.0.0.1');
        try {
            socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
            await ready;
            await host.close({ timeoutMs: 25 });
            await eventually(() => socket.destroyed);
            destroyed = socket.destroyed;
        } finally { socket.destroy(); await host.close(); await arc.dispose(); }
    });

    it('should bound shutdown and destroy the socket', () => { destroyed.should.equal(true); });
});
