// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving services with concurrent scopes and tenants', () => {
    let sharedScoped: boolean[]; let isolatedScoped: boolean; let tenants: (string | undefined)[];
    let sharedSingleton: boolean; let distinctTransients: boolean; let calls: number[]; let disposedFailure: unknown;
    beforeEach(async () => {
        const singleton = serviceToken<{ id: number }>('singleton');
        const scoped = serviceToken<{ tenant: string | undefined }>('scoped');
        const transient = serviceToken<object>('transient');
        let singleCalls = 0; let scopedCalls = 0; let transientCalls = 0;
        const registry = new ServiceRegistry([
            { token: singleton, lifetime: ServiceLifetime.Singleton,
                factory: async () => { singleCalls++; await Promise.resolve(); return { id: singleCalls }; } },
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: async (_resolver,
                identity) => { scopedCalls++; await Promise.resolve(); return { tenant: identity.tenantId }; } },
            { token: transient, lifetime: ServiceLifetime.Transient, factory: () => { transientCalls++; return {}; } }
        ]);
        const a = registry.createScope(serviceContext('a'));
        const b = registry.createScope(serviceContext('b'));
        const [a1, a2, b1, b2] = await Promise.all([a.resolve(scoped), a.resolve(scoped), b.resolve(scoped), b.resolve(scoped)]);
        sharedScoped = [a1 === a2, b1 === b2]; isolatedScoped = a1 !== b1;
        tenants = [a1.tenant, b1.tenant];
        const [s1, s2] = await Promise.all([a.resolve(singleton), b.resolve(singleton)]);
        sharedSingleton = s1 === s2;
        distinctTransients = await a.resolve(transient) !== await a.resolve(transient);
        calls = [singleCalls, scopedCalls, transientCalls];
        await registry.dispose(); await registry.dispose();
        disposedFailure = await captureFailure(Promise.resolve().then(() => registry.createScope(serviceContext('after close'))));
    });
    it('should share in-flight scoped and singleton factories by lifetime', () => {
        sharedScoped.should.deep.equal([true, true]); isolatedScoped.should.equal(true);
        sharedSingleton.should.equal(true); distinctTransients.should.equal(true);
        calls.should.deep.equal([1, 2, 2]);
    });
    it('should isolate scoped tenant identities', () => tenants.should.deep.equal(['a', 'b']));
    it('should make repeated disposal idempotent and reject new scopes', () => (disposedFailure as Error).message.should.match(/disposed/));
});
