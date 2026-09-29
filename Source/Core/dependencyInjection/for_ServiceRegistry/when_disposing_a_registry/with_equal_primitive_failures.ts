// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when two participants throw equal primitive failures', () => {
    let failure: AggregateError;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        for (let index = 0; index < 2; index++) registry.addShutdownParticipant({
            stop: () => { throw 'busy'; }, drain: async () => {}
        });
        failure = await captureFailure(registry.dispose()) as AggregateError;
    });
    it('should report both failures', () => failure.errors.should.deep.equal(['busy', 'busy']));
});
