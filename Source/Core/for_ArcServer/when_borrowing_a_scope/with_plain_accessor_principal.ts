// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import type { Principal } from '../../identity/Principal.js';

should();
describe('when borrowing a scope with a plain principal with accessor fields', () => {
    let snapshot: Principal;
    let factoryPrincipal: Principal;
    let original: Principal;
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
        (principal.roles as string[]).push('Admin');
        (principal.claims as { department: string }).department = 'changed';
        try {
            snapshot = await server.runInScope(scope, async () => {
                factoryPrincipal = await currentServices().resolve(token);
                return currentContext()!.principal!;
            });
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should preserve the required principal fields', () => {
        snapshot.id.should.equal('user');
        snapshot.isAuthenticated.should.equal(true);
        snapshot.roles.should.deep.equal(['Reader']);
    });
    it('should detach and freeze the plain principal', () => {
        (snapshot === original).should.equal(false);
        Object.isFrozen(snapshot).should.equal(true);
        (snapshot.claims as { department: string }).department.should.equal('original');
    });
    it('should give the scoped factory the same principal snapshot', () => {
        (factoryPrincipal === snapshot).should.equal(true);
    });
});
