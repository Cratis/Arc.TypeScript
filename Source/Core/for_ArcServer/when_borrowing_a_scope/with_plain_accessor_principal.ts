// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import type { Principal } from '../../identity/Principal.js';

should();
describe('when a plain principal has accessor fields', () => {
    let scopePrincipal: Principal;
    let factoryPrincipal: Principal;
    let original: Principal;
    let failure: unknown;
    beforeEach(async () => {
        const token = serviceToken<Principal>('factory principal');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: (_scope, execution) => execution.principal! }] });
        const principal: Principal = { id: 'initial', isAuthenticated: false, roles: ['Reader'], claims: { department: 'original' } };
        Object.defineProperties(principal, {
            id: { get: () => 'user' },
            isAuthenticated: { get: () => true }
        });
        original = principal;
        const scope = server.services.createScope({ ...serviceContext('first'), principal });
        try {
            scopePrincipal = scope.identity!.principal!;
            factoryPrincipal = await scope.resolve(token);
            failure = await captureFailure(server.runInScope(scope, () => 'unexpected'));
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should preserve the original principal for ordinary factories and scope identity', () => {
        (scopePrincipal === original).should.equal(true);
        (factoryPrincipal === original).should.equal(true);
        factoryPrincipal.id.should.equal('user');
        factoryPrincipal.isAuthenticated.should.equal(true);
    });
    it('should reject borrowing a principal with accessors', () => {
        (failure as Error).message.should.contain('unsnapshotable principal');
    });
});
