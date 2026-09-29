// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceDependencyError } from '../../ServiceDependencyError.js';

should();
describe('when a participant accessor starts registry shutdown during registration', () => {
    let error: unknown;
    let stopped: boolean;
    let drained: boolean;
    beforeEach(async () => {
        stopped = false; drained = false;
        const registry = new ServiceRegistry();
        let closing!: Promise<void>;
        const participant = {
            get stop() { closing = registry.dispose(); return () => { stopped = true; }; },
            drain: async () => { drained = true; }
        };
        try { registry.addShutdownParticipant(participant); }
        catch (reason) { error = reason; }
        await closing;
    });
    it('should reject the participant excluded from the shutdown snapshot', () => {
        (error instanceof ServiceDependencyError).should.equal(true);
        (error as Error).message.should.equal('Service registry is disposed');
        stopped.should.equal(false);
        drained.should.equal(false);
    });
});
