// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { connect } from 'node:net';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { runArc } from '../runArc.js';
import { portOf } from './given/a_node_host.js';

should();

describe('when the peer disconnects during a query', () => {
    let canceled: boolean;

    beforeEach(async () => {
        let started!: () => void;
        let aborted!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        const cancellation = new Promise<void>(resolve => { aborted = resolve; });
        canceled = false;
        const arc = new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => new Promise(resolve => {
            context.signal.addEventListener('abort', () => { canceled = true; aborted(); resolve('done'); }, { once: true });
            started();
        }) })] });
        const host = await runArc(arc, { port: 0 });
        const socket = connect(portOf(host.server), '127.0.0.1');
        try {
            socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
            await ready;
            socket.destroy();
            await Promise.race([cancellation, new Promise<never>((_resolve, reject) => setTimeout(() => reject(Error('Did not cancel')), 2000))]);
        } finally { socket.destroy(); await host.close(); await arc.dispose(); }
    });

    it('should abort the query context', () => { canceled.should.equal(true); });
});
