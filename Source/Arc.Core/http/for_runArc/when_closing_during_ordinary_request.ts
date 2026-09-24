// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { runArc } from '../runArc.js';
import { exchange, portOf } from './given/a_node_host.js';

should();

describe('when closing during an ordinary request', () => {
    let finishedBeforeRelease: boolean;
    let returned: string;
    let finished: boolean;
    let disposed: boolean;

    beforeEach(async () => {
        let release!: (value: string) => void;
        let started!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        const arc = new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: () => {
            started();
            return new Promise<string>(resolve => { release = resolve; });
        } })] });
        const host = await runArc(arc, { port: 0 });
        const pending = exchange(portOf(host.server), '/api/wait', 'GET', { connection: 'close' });
        try {
            await ready;
            finished = false;
            const closing = host.close().then(() => { finished = true; });
            await new Promise(resolve => setImmediate(resolve));
            finishedBeforeRelease = finished;
            release('finished');
            returned = JSON.parse((await pending).body).data;
            await closing;
            disposed = arc.services.disposed;
        } finally { await arc.dispose(); }
    });

    it('should wait for the in-flight request', () => { finishedBeforeRelease.should.equal(false); });
    it('should deliver the request response', () => { returned.should.equal('finished'); });
    it('should finish after the request completes', () => { finished.should.equal(true); });
    it('should not dispose caller-owned Arc', () => { disposed.should.equal(false); });
});
