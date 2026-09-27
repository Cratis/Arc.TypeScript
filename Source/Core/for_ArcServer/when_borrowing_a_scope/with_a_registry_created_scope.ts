// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when borrowing a registry-created scope', () => {
    let observed: ReturnType<typeof currentContext>;
    let originalPrincipal: object;
    let scopePrincipal: object;
    beforeEach(async () => {
        const server = new ArcServer({});
        const principal = { id: 'original', isAuthenticated: true, roles: ['Reader'] };
        const scope = server.services.createScope({ ...serviceContext('tenant'), principal });
        originalPrincipal = principal;
        scopePrincipal = scope.identity!.principal!;
        principal.roles.push('Admin');
        try { observed = await server.runInScope(scope, () => currentContext()); }
        finally { await scope.dispose(); await server.dispose(); }
    });
    it('should retain the original principal for scope factories', () => {
        (scopePrincipal === originalPrincipal).should.equal(true);
    });
    it('should expose the creation-time frozen principal to borrowed work', () => {
        observed!.principal!.roles.should.deep.equal(['Reader']);
        Object.isFrozen(observed!.principal!.roles).should.equal(true);
        observed!.tenantId!.should.equal('tenant');
    });
});
