// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { expectTypeOf } from 'vitest';
import * as publicApi from '../../../index.js';
import type { ExecutionContext } from '../../../execution/ExecutionContext.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceScope } from '../../ServiceScope.js';
import { serviceToken } from '../../ServiceToken.js';
import { serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when constructing a scope with forged root authority', () => {
    let bypasses: unknown[];
    let forgedErrors: unknown[];
    let creations: number;
    let rejectedAfterClose: boolean;
    beforeEach(async () => {
        const singleton = serviceToken<object>('single root'); creations = 0;
        const registry = new ServiceRegistry([{ token: singleton, lifetime: 'singleton', factory: () => { creations++; return {}; } }]);
        try {
            bypasses = [
                ...['disposeInternal', 'disposeCreated'].map(method => [Object.hasOwn(ServiceScope.prototype, method), (registry.singletonScope() as unknown as Record<string, unknown>)[method]]),
                ...['withDisposal', 'disposing'].map(method => [Object.hasOwn(ServiceRegistry.prototype, method), (registry as unknown as Record<string, unknown>)[method]]),
                ...['closeServiceScope', 'disposeCreatedServices', 'createSingletonServiceScope'].map(helper => Object.hasOwn(publicApi, helper))
            ];
            forgedErrors = [];
            for (const authority of [true, Symbol('singleton scope')]) {
                try { Reflect.construct(ServiceScope, [registry, serviceContext('invalid'), authority]); }
                catch (error) { forgedErrors.push(error); }
            }
            const manual = new ServiceScope(registry, serviceContext('direct'));
            await manual.resolve(singleton);
            await registry.singletonScope().resolve(singleton);
            await manual.dispose();
        } finally { await registry.dispose(); }
        try { Reflect.construct(ServiceScope, [registry, undefined, true]); }
        catch (error) { forgedErrors.push(error); }
        try { new ServiceScope(registry, serviceContext('after close')); }
        catch (error) { rejectedAfterClose = (error as Error).message.includes('disposed'); }
    });
    it('should expose no internal disposal bypass in declarations', () => {
        expectTypeOf<ServiceScope>().not.toHaveProperty('disposeInternal');
        expectTypeOf<ServiceScope>().not.toHaveProperty('disposeCreated');
        expectTypeOf<ServiceRegistry>().not.toHaveProperty('withDisposal');
        expectTypeOf<ServiceRegistry>().not.toHaveProperty('disposing');
        expectTypeOf<ConstructorParameters<typeof ServiceScope>>().toEqualTypeOf<[ServiceRegistry, ExecutionContext | undefined]>();
        expectTypeOf<typeof publicApi>().not.toHaveProperty('closeServiceScope');
        expectTypeOf<typeof publicApi>().not.toHaveProperty('disposeCreatedServices');
        expectTypeOf<typeof publicApi>().not.toHaveProperty('createSingletonServiceScope');
    });
    it('should expose no internal disposal bypass at runtime', () => {
        bypasses.should.deep.equal([[false, undefined], [false, undefined], [false, undefined], [false, undefined], false, false, false]);
    });
    it('should reject forged root scopes while allowing normal construction', () => {
        forgedErrors.should.have.lengthOf(3);
        forgedErrors.map(error => (error as Error).message).every(message => /Invalid service scope construction/.test(message)).should.equal(true);
        creations.should.equal(1);
        rejectedAfterClose.should.equal(true);
    });
});
