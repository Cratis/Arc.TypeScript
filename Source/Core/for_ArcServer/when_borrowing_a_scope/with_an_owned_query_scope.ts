// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { Principal } from '../../identity/Principal.js';

should();
describe('when borrowing an Arc-owned query scope', () => {
    let failure: unknown;
    let callbacks: number;
    let traversals: number;
    let originalPrincipal: boolean;
    let succeeded: boolean;
    beforeEach(async () => {
        callbacks = 0;
        traversals = 0;
        const principal = new Proxy<Principal>({ id: 'caller', isAuthenticated: true, roles: ['Reader'] }, {
            getPrototypeOf: () => { traversals++; throw new Error('Principal should not be traversed'); }
        });
        const server = new ArcServer({ queries: [defineQuery({ name: 'Owned', schema: z.object({}),
            perform: async () => {
                const scope = currentServices();
                originalPrincipal = scope.identity?.principal === principal;
                failure = await captureFailure(server.runInScope(scope, () => { callbacks++; }));
                return 'done';
            } })] });
        try {
            succeeded = (await server.performQuery('Owned', {}, { ...serviceContext('tenant'), principal })).isSuccess;
        } finally { await server.dispose(); }
    });
    it('should reject borrowing before calling back', () => {
        (failure as Error).message.should.contain('was not created by services.createScope');
        callbacks.should.equal(0);
        succeeded.should.equal(true);
    });
    it('should not traverse the principal when creating the owned scope', () => {
        traversals.should.equal(0);
        originalPrincipal.should.equal(true);
    });
});
