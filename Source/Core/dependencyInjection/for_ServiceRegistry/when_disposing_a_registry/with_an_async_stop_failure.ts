// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { beforeDeadline, captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when an asynchronous participant stop rejects', () => {
    let failure: AggregateError;
    let drained: boolean;
    beforeEach(async () => {
        drained = false;
        const registry = new ServiceRegistry();
        registry.addShutdownParticipant({ stop: async () => { await Promise.resolve(); throw new Error('async stop failed'); },
            drain: async () => { drained = true; } });
        failure = await beforeDeadline(captureFailure(registry.dispose()), 'asynchronous stop shutdown') as AggregateError;
    });
    it('should collect the stop rejection without skipping drain', () => {
        drained.should.equal(true);
        failure.message.should.equal('Service registry disposal failed');
        (failure.errors[0] as Error).message.should.equal('async stop failed');
    });
});
