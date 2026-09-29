// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceDependencyError } from '../../ServiceDependencyError.js';
import { beforeDeadline, gate } from '../given/a_service_lifecycle.js';

should();
describe('when registering a shutdown participant after shutdown starts', () => {
    let failure: unknown;
    let stopped: boolean;
    let removedStopped: boolean;
    beforeEach(async () => {
        stopped = false; removedStopped = false;
        const entered = gate(); const release = gate();
        const registry = new ServiceRegistry();
        const remove = registry.addShutdownParticipant({ stop: () => { removedStopped = true; }, drain: async () => {} });
        remove(); remove();
        registry.addShutdownParticipant({ stop: () => { stopped = true; entered.release(); }, drain: async () => { await release.promise; } });
        try {
            const closing = registry.dispose();
            try { registry.addShutdownParticipant({ stop: () => {}, drain: async () => {} }); } catch (error) { failure = error; }
            await beforeDeadline(entered.promise, 'participant stop');
            release.release();
            await beforeDeadline(closing, 'participant shutdown');
        } finally { release.release(); await registry.dispose(); }
    });
    it('should close registration atomically with admission', () => (failure instanceof ServiceDependencyError).should.be.true);
    it('should stop only registered participants', () => { stopped.should.equal(true); removedStopped.should.equal(false); });
});
