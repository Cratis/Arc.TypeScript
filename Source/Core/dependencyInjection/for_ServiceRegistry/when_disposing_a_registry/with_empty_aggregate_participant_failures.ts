// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when stop and drain reject with empty aggregate errors', () => {
    let failure: unknown;
    let stopError: AggregateError;
    let drainError: AggregateError;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        stopError = new AggregateError([], 'stop failed');
        drainError = new AggregateError([], 'drain failed');
        registry.addShutdownParticipant({ stop: () => { throw stopError; }, drain: async () => { throw drainError; } });
        failure = await captureFailure(registry.dispose());
    });
    it('should retain both empty aggregates', () => {
        (failure instanceof AggregateError).should.equal(true);
        (failure as AggregateError).errors.should.deep.equal([stopError, drainError]);
    });
});
