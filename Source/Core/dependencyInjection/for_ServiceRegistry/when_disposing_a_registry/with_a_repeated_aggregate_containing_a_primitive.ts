// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when registry cleanup reports the same aggregate with a primitive twice', () => {
    let failure: AggregateError;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        const original = new AggregateError(['cleanup failed'], 'cleanup failed');
        registry.addShutdownCleanup(() => {}, async () => { throw original; }, async () => { throw original; });
        failure = await captureFailure(registry.dispose()) as AggregateError;
    });
    it('should report the originating failure once', () => {
        failure.errors.should.have.lengthOf(1);
        (failure.errors[0] as AggregateError).errors.should.deep.equal(['cleanup failed']);
    });
});
