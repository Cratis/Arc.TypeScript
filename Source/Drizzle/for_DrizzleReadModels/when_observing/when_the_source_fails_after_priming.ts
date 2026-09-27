// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

// A resolved current() must not mask a subsequent listener failure during adoption.
describe('when the source fails after an unused prime resolves', () => {
    let delivered: Error | undefined;
    let released: number;
    let idle: number;
    beforeEach(async () => {
        let fail!: (error: Error) => void;
        released = 0; idle = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            async () => 1, (_, error) => { fail = error; return { ready: Promise.resolve(), release: () => { released++; } }; },
            undefined, closed), () => {}, () => {}, () => { idle++; });
        (await observation.current()).value.should.equal(1);
        fail(new Error('listener lost'));
        observation.subscribe({ error: error => { delivered = error; } });
    });
    it('should deliver the retained failure rather than a stale snapshot', () => delivered?.message.should.equal('listener lost'));
    it('should release the lease and notify its owner once', () => { released.should.equal(1); idle.should.equal(1); });
});
