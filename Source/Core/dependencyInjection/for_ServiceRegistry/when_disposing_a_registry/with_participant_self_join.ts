// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceDependencyError } from '../../ServiceDependencyError.js';
import { beforeDeadline, captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry from inside its shutdown participant', () => {
    let stopFailure: unknown;
    let drainFailure: unknown;
    let finished: boolean;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        registry.addShutdownParticipant({
            stop: () => { void captureFailure(registry.dispose()).then(error => { stopFailure = error; }); },
            drain: async () => { drainFailure = await captureFailure(registry.dispose()); }
        });
        await beforeDeadline(registry.dispose(), 'participant self-join');
        await Promise.resolve();
        finished = registry.disposed;
    });
    it('should reject a stop callback joining its own shutdown', () => {
        (stopFailure instanceof ServiceDependencyError).should.equal(true);
        (stopFailure as Error).message.should.match(/Cannot await/);
    });
    it('should reject a drain callback joining its own shutdown', () => {
        (drainFailure instanceof ServiceDependencyError).should.equal(true);
        (drainFailure as Error).message.should.match(/Cannot await/);
    });
    it('should finish shutdown', () => finished.should.be.true);
});
