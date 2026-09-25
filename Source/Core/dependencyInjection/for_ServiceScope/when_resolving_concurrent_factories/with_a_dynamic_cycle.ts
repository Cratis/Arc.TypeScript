// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving concurrent factories with a dynamic cycle', () => {
    let statuses: string[];
    beforeEach(async () => {
        const a = serviceToken<object>('a'); const b = serviceToken<object>('b');
        const registry = new ServiceRegistry([
            { token: a, lifetime: ServiceLifetime.Scoped,
                factory: async resolver => { await Promise.resolve(); return resolver.resolve(b); } },
            { token: b, lifetime: ServiceLifetime.Scoped,
                factory: async resolver => { await Promise.resolve(); return resolver.resolve(a); } }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        const results = await Promise.allSettled([scope.resolve(a), scope.resolve(b)]);
        statuses = results.map(result => result.status);
        await registry.dispose();
    });
    it('should reject both requests without deadlocking', () => statuses.should.deep.equal(['rejected', 'rejected']));
});
