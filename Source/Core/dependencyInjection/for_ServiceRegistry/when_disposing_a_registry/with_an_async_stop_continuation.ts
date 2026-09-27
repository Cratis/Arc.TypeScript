// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceDependencyError } from '../../ServiceDependencyError.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { beforeDeadline, captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when a stop continuation tries to join its own shutdown', () => {
    let failure: unknown;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        let stopping!: Promise<unknown>;
        registry.addShutdownParticipant({
            stop: () => { stopping = (async () => {
                await Promise.resolve();
                return captureFailure(registry.dispose());
            })(); },
            drain: async () => { failure = await stopping; }
        });
        await beforeDeadline(registry.dispose(), 'stop continuation shutdown');
    });
    it('should reject the self-join and let drain settle', () => {
        (failure instanceof ServiceDependencyError).should.equal(true);
        (failure as Error).message.should.match(/Cannot await/);
    });
});
