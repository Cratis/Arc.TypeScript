// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when a participant drain rejects with an empty aggregate', () => {
    let failure: unknown;
    let original: AggregateError;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        original = new AggregateError([], 'drain failed');
        registry.addShutdownParticipant({ stop: () => {}, drain: async () => { throw original; } });
        failure = await captureFailure(registry.dispose());
    });
    it('should report the drain failure', () => {
        (failure instanceof AggregateError).should.equal(true);
        (failure as AggregateError).errors.should.deep.equal([original]);
    });
});
