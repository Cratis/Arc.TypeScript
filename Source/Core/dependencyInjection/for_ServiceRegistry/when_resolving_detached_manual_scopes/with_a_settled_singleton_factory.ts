// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving detached manual scopes after a singleton factory settles', () => {
    let tenants: readonly (string | undefined)[];
    beforeEach(async () => {
        const origin = serviceToken<object>('singleton origin');
        const tenant = serviceToken<{ tenant: string | undefined }>('scoped tenant');
        const transient = serviceToken<{ tenant: string | undefined }>('transient tenant');
        const started = gate(); const released = gate();
        let detached!: Promise<readonly (string | undefined)[]>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: 'singleton', factory: () => {
                detached = (async () => {
                    started.release(); await released.promise;
                    const beta = registry.createScope(serviceContext('beta'));
                    try { return [(await beta.resolve(tenant)).tenant, (await beta.resolve(transient)).tenant]; }
                    finally { await beta.dispose(); }
                })();
                return {};
            } },
            { token: tenant, lifetime: 'scoped', factory: (_scope, identity) => ({ tenant: identity.tenantId }) },
            { token: transient, lifetime: 'transient', factory: (_scope, identity) => ({ tenant: identity.tenantId }) }
        ]);
        const alpha = registry.createScope(serviceContext('alpha'));
        try {
            await alpha.resolve(origin);
            await started.promise;
            await alpha.dispose();
            released.release();
            tenants = await beforeDeadline(detached, 'detached singleton owner');
        } finally { released.release(); await registry.dispose(); }
    });
    it('should resolve scoped and transient services without carrying settled singleton captivity', () => tenants.should.deep.equal(['beta', 'beta']));
});
