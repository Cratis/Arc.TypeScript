// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure } from '../given/a_service_lifecycle.js';

should();
for (const hasParticipants of [false, true]) {
    describe(`when a singleton disposer throws an empty aggregate ${hasParticipants ? 'with' : 'without'} participants`, () => {
        let failure: unknown;
        let original: AggregateError;
        beforeEach(async () => {
            original = new AggregateError([], 'singleton failed');
            const token = serviceToken<object>('singleton');
            const registry = new ServiceRegistry([{ token, lifetime: ServiceLifetime.Singleton,
                factory: () => ({ [Symbol.dispose]: () => { throw original; } }) }]);
            await registry.singletonScope().resolve(token);
            if (hasParticipants) registry.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
            failure = await captureFailure(registry.dispose());
        });
        it('should retain the empty aggregate', () => {
            (failure instanceof AggregateError).should.equal(true);
            ((failure as AggregateError).errors[0] as AggregateError).errors.should.deep.equal([original]);
        });
    });
}
