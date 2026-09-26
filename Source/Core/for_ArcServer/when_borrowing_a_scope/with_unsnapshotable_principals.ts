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
    let tenants: (string | undefined)[];
    beforeEach(async () => {
        const token = serviceToken<Principal>('legacy principal');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: (_scope, execution) => execution.principal! }],
        queries: [defineQuery({ name: 'Legacy', schema: z.object({}), handlerDependencies: [token],
            perform: async () => (await currentServices().resolve(token)).id })] });
        let deep: Record<string, unknown> = { value: 'end' };
        for (let depth = 0; depth < 34; depth++) deep = { child: deep };
        class LegacyPrincipal implements Principal {
            readonly #identifier = 'class';
            readonly isAuthenticated = true;
            readonly roles = ['Reader'];
            get id(): string { return this.#identifier; }
        }
        class LegacyClaim {
            readonly #value = 'nested';
            get value(): string { return this.#value; }
        }
        const symbolKey = Symbol('claim key');
        const nonEnumerable = { department: 'research' };
        Object.defineProperty(nonEnumerable, 'private', { value: 'hidden', enumerable: false });
        const getterClaim = { department: 'research' };
        Object.defineProperty(getterClaim, 'department', { get: () => 'research', enumerable: true });
        const topSymbolPrincipal = { id: 'top symbol', isAuthenticated: true, roles: ['Reader'], [symbolKey]: 'secret' };
        const hiddenPrincipal = { id: 'hidden', isAuthenticated: true, roles: ['Reader'] };
        Object.defineProperty(hiddenPrincipal, 'department', { value: 'research', enumerable: false });
        const principals: Principal[] = [
            new LegacyPrincipal(),
            topSymbolPrincipal,
            hiddenPrincipal,
            { id: 'nested', isAuthenticated: true, roles: ['Reader'], claims: { legacy: new LegacyClaim() } },
            { id: 'function', isAuthenticated: true, roles: ['Reader'], claims: { call: () => true } },
            { id: 'symbol', isAuthenticated: true, roles: ['Reader'], claims: { value: Symbol('claim') } },
            { id: 'symbol key', isAuthenticated: true, roles: ['Reader'], claims: { [symbolKey]: 'secret' } },
            { id: 'nonenumerable', isAuthenticated: true, roles: ['Reader'], claims: nonEnumerable },
            { id: 'getter', isAuthenticated: true, roles: ['Reader'], claims: getterClaim },
            { id: 'map', isAuthenticated: true, roles: ['Reader'], claims: { groups: new Map([['a', { role: 'Admin' }]]) } },
            { id: 'set', isAuthenticated: true, roles: ['Reader'], claims: { groups: new Set([{ role: 'Admin' }]) } },
            { id: 'date', isAuthenticated: true, roles: ['Reader'], claims: { issued: new Date() } },
            { id: 'deep', isAuthenticated: true, roles: ['Reader'], claims: deep },
            { id: 'roles', isAuthenticated: true, roles: 'Reader' as unknown as string[] }
        ];
        responses = [];
        failures = [];
        callbacks = 0;
        tenants = [];
        try {
            for (const principal of principals) {
                const identity = { ...serviceContext('first'), principal };
                const scope = server.services.createScope(identity);
                try {
                    if (scope.identity?.principal !== principal) throw new Error('Legacy principal changed');
                    (identity as { tenantId?: string }).tenantId = 'second';
                    tenants.push(scope.identity?.tenantId);
                    const response = await server.performQuery('Legacy', {}, identity);
                    responses.push(response.data);
                    failures.push(await captureFailure(server.runInScope(scope, () => { callbacks++; })));
                } finally { await scope.dispose(); }
            }
        } finally { await server.dispose(); }
    });
    it('should keep ordinary query requests working with their original principal', () => {
        responses.should.deep.equal(['class', 'top symbol', 'hidden', 'nested', 'function', 'symbol', 'symbol key', 'nonenumerable', 'getter', 'map', 'set', 'date', 'deep', 'roles']);
    });
    it('should keep the creation-time tenant when the original context changes', () => {
        tenants.should.deep.equal(Array(14).fill('first'));
    });
    it('should reject borrowed execution before the callback runs', () => {
        callbacks.should.equal(0);
        failures.forEach(failure => {
            (failure instanceof ServiceDependencyError).should.equal(true);
            (failure as Error).message.should.contain('unsnapshotable principal');
        });
    });
});
