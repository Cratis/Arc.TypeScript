// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceScope } from '../../ServiceScope.js';
import { serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when assigning scope identity with public getters', () => {
    let results: { setter: unknown; own: boolean; changed: boolean; throws: boolean; preserved: boolean }[];
    let identitiesPreserved: boolean;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        const identity = { ...serviceContext('original'), principal: { id: 'user', roles: ['Reader'], isAuthenticated: true } };
        const scope = registry.createScope(identity);
        const readOnlyAssignments = (target: ServiceScope): void => {
            // @ts-expect-error singleton has no public setter
            target.singleton = true;
            // @ts-expect-error registry has no public setter
            target.registry = registry;
            // @ts-expect-error identity has no public setter
            target.identity = identity;
        };
        void readOnlyAssignments;
        try {
            results = Object.entries({ singleton: true, registry: {}, identity: serviceContext('forged') }).map(([name, replacement]) => {
                const original = Reflect.get(scope, name);
                let throws = false;
                try { Object.assign(scope, { [name]: replacement }); } catch (error) { throws = error instanceof TypeError; }
                return { setter: Object.getOwnPropertyDescriptor(ServiceScope.prototype, name)?.set,
                    own: Object.hasOwn(scope, name), changed: Reflect.set(scope, name, replacement), throws,
                    preserved: Reflect.get(scope, name) === original };
            });
            identitiesPreserved = !scope.singleton && scope.registry === registry && scope.identity !== identity &&
                scope.identity?.tenantId === identity.tenantId && scope.identity?.correlationId === identity.correlationId &&
                scope.identity?.signal === identity.signal && scope.identity?.principal?.id === identity.principal.id &&
                scope.identity?.principal?.roles[0] === identity.principal.roles[0] &&
                scope.identity?.principal === identity.principal && Object.isFrozen(scope.identity);
        } finally { await registry.dispose(); }
    });
    it('should have no writable own or prototype identity setters', () => {
        results.map(result => [result.setter, result.own, result.changed, result.throws, result.preserved])
            .should.deep.equal(Array(3).fill(undefined).map(() => [undefined, false, false, true, true]));
    });
    it('should retain the creation-time identity in a frozen non-replaceable getter', () => identitiesPreserved.should.be.true);
});
