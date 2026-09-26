// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when borrowing a scope with extra principal fields', () => {
    let department: string;
    let frozen: boolean;
    let mutationFailure: unknown;
    let nextClaim: string;
    beforeEach(async () => {
        const server = new ArcServer({});
        const principal = { id: 'user', isAuthenticated: true, roles: ['Reader'],
            claims: { group: { name: 'original' } }, department: { team: { name: 'original' } } };
        const scope = server.services.createScope({ ...serviceContext('first'), principal });
        principal.department.team.name = 'changed';
        try {
            await server.runInScope(scope, () => {
                const captured = currentContext()!.principal as typeof principal;
                department = captured.department.team.name;
                frozen = Object.isFrozen(captured.department) && Object.isFrozen(captured.department.team) &&
                    Object.isFrozen(captured.claims.group) && Object.isFrozen(captured.roles);
                try { captured.claims.group.name = 'forged'; } catch (error) { mutationFailure = error; }
            });
            await server.runInScope(scope, () => {
                nextClaim = (currentContext()!.principal as typeof principal).claims.group.name;
            });
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should detach nested extra fields from the caller', () => department.should.equal('original'));
    it('should freeze nested extra fields and claims', () => frozen.should.be.true);
    it('should prevent one borrowed callback from changing the next callback claims', () => {
        (mutationFailure instanceof TypeError).should.equal(true);
        nextClaim.should.equal('original');
    });
});
