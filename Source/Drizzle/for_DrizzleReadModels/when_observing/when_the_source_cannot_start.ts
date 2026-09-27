// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

// A disposed PostgreSQL manager rejects new leases synchronously.
describe('when the source cannot start an observation', () => {
    let thrown: Error | undefined;
    let closed: number;
    let uncaught: unknown;
    const onUncaught = (error: unknown): void => { uncaught = error; };
    beforeEach(async () => {
        closed = 0; thrown = undefined; uncaught = undefined;
        process.on('uncaughtException', onUncaught);
        const controller = new AbortController();
        try {
            new DrizzleObservationSession(async () => 1, () => { throw new Error('observations are disposed'); },
                controller.signal, () => { closed++; });
        } catch (error) { thrown = error as Error; }
        controller.abort();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
    afterEach(() => { process.off('uncaughtException', onUncaught); });
    it('should fail construction with the source error', () => thrown?.message.should.equal('observations are disposed'));
    it('should not close the session when the scope later aborts', () => closed.should.equal(0));
    it('should not raise an uncaught error', () => (uncaught === undefined).should.be.true);
});
