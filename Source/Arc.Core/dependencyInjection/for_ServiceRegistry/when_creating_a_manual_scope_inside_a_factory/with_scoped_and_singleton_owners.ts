// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when creating a manual scope inside a factory with scoped and singleton owners', () => {
    let manualTenant: string | undefined; let singletonFailure: unknown;
    beforeEach(async () => {
        const outer = serviceToken<object>('outer scoped');
        const inner = serviceToken<{ tenant: string | undefined }>('manual tenant');
        const singleton = serviceToken<object>('manual singleton');
        const registry = new ServiceRegistry([
            { token: inner, lifetime: 'scoped', factory: (_resolver, identity) => ({ tenant: identity.tenantId }) },
            { token: outer, lifetime: 'scoped', factory: async () => {
                const beta = registry.createScope(serviceContext('beta'));
                try { manualTenant = (await beta.resolve(inner)).tenant; }
                finally { await beta.dispose(); }
                return {};
            } },
            { token: singleton, lifetime: 'singleton', factory: async () => {
                const beta = registry.createScope(serviceContext('beta'));
                try { await beta.resolve(inner); }
                finally { await beta.dispose(); }
                return {};
            } }
        ]);
        const alpha = registry.createScope(serviceContext('alpha'));
        try {
            await alpha.resolve(outer);
            singletonFailure = await captureFailure(alpha.resolve(singleton));
        } finally { await registry.dispose(); }
    });
    it('should use the manual identity for a scoped owner', () => (manualTenant as string).should.equal('beta'));
    it('should reject captive scope resolution by a singleton owner', () => (singletonFailure as Error).message.should.match(/Captive/));
});
