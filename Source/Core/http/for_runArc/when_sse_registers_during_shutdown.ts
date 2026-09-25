// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { connect } from 'node:net';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { runArc } from '../runArc.js';
import { eventually, portOf } from './given/a_node_host.js';

should();

describe('when SSE registers during host shutdown', () => {
    let finishedBeforeRelease: boolean;
    let finished: boolean;
    let elapsed: number;
    let destroyed: boolean;

    beforeEach(async () => {
        let release!: () => void;
        let entered!: () => void;
        const ready = new Promise<void>(resolve => { entered = resolve; });
        const gate = new Promise<void>(resolve => { release = resolve; });
        const values = CurrentValueSubject.of<number[]>([1]);
        const arc = new ArcServer({ tenancy: { resolve: async () => { entered(); await gate; return undefined; } },
            observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => values })] });
        const host = await runArc(arc, { port: 0 });
        const socket = connect(portOf(host.server), '127.0.0.1');
        socket.resume();
        try {
            socket.on('connect', () => socket.write('GET /api/numbers HTTP/1.1\r\nHost: localhost\r\nAccept: text/event-stream\r\n\r\n'));
            await ready;
            finished = false;
            const started = Date.now();
            const closing = host.close({ timeoutMs: 2000 }).then(() => { finished = true; });
            await new Promise(resolve => setImmediate(resolve));
            finishedBeforeRelease = finished;
            release();
            await closing;
            elapsed = Date.now() - started;
            await eventually(() => socket.destroyed);
            destroyed = socket.destroyed;
        } finally { release(); socket.destroy(); await host.close(); await arc.dispose(); }
    });

    it('should wait for registration to finish', () => { finishedBeforeRelease.should.equal(false); });
    it('should complete host shutdown', () => { finished.should.equal(true); });
    it('should complete before the timeout', () => { (elapsed < 1000).should.equal(true); });
    it('should close the late SSE socket', () => { destroyed.should.equal(true); });
});
