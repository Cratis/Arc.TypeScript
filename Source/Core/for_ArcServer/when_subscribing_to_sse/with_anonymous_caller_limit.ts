// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when subscribing to SSE with an anonymous caller limit', () => {
    let admitted: number[];
    let limited: Response | null;
    let hasExceptions: boolean;
    let snapshotStatus: number | undefined;

    beforeEach(async () => {
        const subject = new CurrentValueSubject<number>(1);
        const server = new ArcServer({ query: { maxObservableSubscriptions: 16, maxObservableSubscriptionsPerCaller: 8 },
            observableQueries: [defineObservableQuery({ name: 'Value', schema: z.object({}), observe: () => subject })] });
        const streams: Response[] = [];
        admitted = [];
        for (let index = 0; index < 8; index++) {
            const stream = await server.handle(new Request('http://localhost/api/value', {
                headers: { accept: 'text/event-stream' }
            }), { remoteAddress: '127.0.0.1' });
            admitted.push(stream!.status);
            streams.push(stream!);
        }
        limited = await server.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }), { remoteAddress: '127.0.0.1' });
        hasExceptions = (await limited!.clone().json()).hasExceptions;
        snapshotStatus = (await server.handle(new Request('http://localhost/api/value')))?.status;
        for (const stream of streams) await stream.body?.cancel();
        await server.dispose();
    });

    it('should admit the first eight streams', () => { admitted.every(status => status === 200).should.equal(true); });
    it('should reject a ninth stream', () => { limited?.status.should.equal(503); });
    it('should advise retrying', () => { limited?.headers.get('retry-after')?.should.equal('1'); });
    it('should report an exception for the limit', () => { hasExceptions.should.equal(true); });
    it('should still allow current snapshots', () => { snapshotStatus?.should.equal(200); });
});
