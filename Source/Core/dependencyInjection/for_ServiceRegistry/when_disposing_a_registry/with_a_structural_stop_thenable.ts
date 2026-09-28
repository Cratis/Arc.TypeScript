// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceDependencyError } from '../../ServiceDependencyError.js';
import { beforeDeadline, captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when a structural stop thenable joins its own shutdown', () => {
    let failure: unknown;
    let drained: boolean;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        drained = false;
        registry.addShutdownParticipant({
            stop: () => ({ then(resolve: () => void, reject: (error: unknown) => void): void {
                void registry.dispose().then(resolve, reject);
            } }),
            drain: async () => { drained = true; }
        });
        failure = await beforeDeadline(captureFailure(registry.dispose()), 'structural stop thenable shutdown');
    });
    it('should reject the self join without hanging drain', () => {
        drained.should.equal(true);
        (failure as AggregateError).errors.should.have.lengthOf(1);
        ((failure as AggregateError).errors[0] instanceof ServiceDependencyError).should.equal(true);
    });
});
