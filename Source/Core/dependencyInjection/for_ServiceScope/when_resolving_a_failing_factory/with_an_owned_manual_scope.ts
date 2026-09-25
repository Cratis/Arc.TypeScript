// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving a failing factory with an owned manual scope', () => {
    let failure: unknown; let disposals: string[]; let scopeDisposed: boolean;
    beforeEach(async () => {
        disposals = []; const partial = serviceToken<object>('partial'); const broken = serviceToken<object>('failure');
        const registry = new ServiceRegistry([
            { token: partial, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.dispose]: () => { disposals.push('disposed'); } }) },
            { token: broken, lifetime: ServiceLifetime.Scoped, dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial); throw new Error('failed');
            } }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        failure = await captureFailure(scope.resolve(broken));
        scopeDisposed = scope.disposed;
        await registry.dispose();
    });
    it('should reject the factory and dispose the partial graph and owned scope', () => {
        (failure as Error).message.should.match(/factory failed/);
        disposals.should.deep.equal(['disposed']); scopeDisposed.should.equal(true);
    });
});
