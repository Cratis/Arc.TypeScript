// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceDependencyError } from '../../dependencyInjection/ServiceDependencyError.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { Principal } from '../../identity/Principal.js';

should();
describe('when a principal cannot be snapshotted for borrowing', () => {
    let responses: unknown[];
    let failures: unknown[];
    let callbacks: number;
    beforeEach(async () => {
        const token = serviceToken<Principal>('legacy principal');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: (_scope, execution) => execution.principal! }],
        queries: [defineQuery({ name: 'Legacy', schema: z.object({}), handlerDependencies: [token],
            perform: async () => (await currentServices().resolve(token)).id })] });
        let deep: Record<string, unknown> = { value: 'end' };
        for (let depth = 0; depth < 34; depth++) deep = { child: deep };
        const principals: Principal[] = [
            { id: 'function', isAuthenticated: true, roles: ['Reader'], claims: { call: () => true } },
            { id: 'symbol', isAuthenticated: true, roles: ['Reader'], claims: { value: Symbol('claim') } },
            { id: 'deep', isAuthenticated: true, roles: ['Reader'], claims: deep },
            { id: 'roles', isAuthenticated: true, roles: 'Reader' as unknown as string[] }
        ];
        responses = [];
        failures = [];
        callbacks = 0;
        try {
            for (const principal of principals) {
                const identity = { ...serviceContext('first'), principal };
                const scope = server.services.createScope(identity);
                try {
                    if (scope.identity?.principal !== principal) throw new Error('Legacy principal changed');
                    const response = await server.performQuery('Legacy', {}, identity);
                    responses.push(response.data);
                    failures.push(await captureFailure(server.runInScope(scope, () => { callbacks++; })));
                } finally { await scope.dispose(); }
            }
        } finally { await server.dispose(); }
    });
    it('should keep ordinary query requests working with their original principal', () => {
        responses.should.deep.equal(['function', 'symbol', 'deep', 'roles']);
    });
    it('should reject borrowed execution before the callback runs', () => {
        callbacks.should.equal(0);
        failures.forEach(failure => {
            (failure instanceof ServiceDependencyError).should.equal(true);
            (failure as Error).message.should.contain('unsnapshotable principal');
        });
    });
});
