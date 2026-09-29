// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when two scopes report the same failure without participants', () => {
    let failure: AggregateError;
    let original: Error;
    beforeEach(async () => {
        original = new Error('shared close failed');
        const resource = serviceToken<object>('shared resource');
        const registry = new ServiceRegistry([{ token: resource, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.asyncDispose]: async () => { throw original; } }) }]);
        for (const tenant of ['first', 'second']) {
            const scope = registry.createScope(serviceContext(tenant));
            await scope.resolve(resource);
        }
        failure = await captureFailure(registry.dispose()) as AggregateError;
    });
    it('should report every failure as main did', () => {
        failure.message.should.equal('Service registry disposal failed');
        failure.errors.should.have.lengthOf(2);
    });
    it('should report the original failures unwrapped', () => {
        failure.errors.every(error => error === original || (error as AggregateError).errors?.includes(original)).should.equal(true);
    });
});
