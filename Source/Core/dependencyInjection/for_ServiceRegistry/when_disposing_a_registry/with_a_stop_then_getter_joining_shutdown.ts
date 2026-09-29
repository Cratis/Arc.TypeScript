// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceDependencyError } from '../../ServiceDependencyError.js';
import { captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when reading a stop thenable getter joins its own shutdown', () => {
    let getterFailure: unknown;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        registry.addShutdownParticipant({
            stop: () => ({ get then() {
                void captureFailure(registry.dispose()).then(error => { getterFailure = error; });
                return (resolve: () => void) => resolve();
            } }),
            drain: async () => {}
        });
        await registry.dispose();
        await Promise.resolve();
    });
    it('should reject the self join from the getter', () => {
        (getterFailure instanceof ServiceDependencyError).should.equal(true);
    });
});
