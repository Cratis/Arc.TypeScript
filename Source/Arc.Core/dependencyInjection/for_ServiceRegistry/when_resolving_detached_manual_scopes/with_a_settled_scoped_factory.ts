// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving detached manual scopes after a scoped factory settles', () => {
    let tenantId: string | undefined;
    beforeEach(async () => {
        const origin = serviceToken<object>('origin');
        const tenant = serviceToken<{ tenant: string | undefined }>('tenant');
        const started = gate(); const released = gate();
        let detached!: Promise<string | undefined>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: 'scoped', factory: () => {
                detached = (async () => {
                    started.release(); await released.promise;
                    const beta = registry.createScope(serviceContext('beta'));
                    try { return (await beta.resolve(tenant)).tenant; } finally { await beta.dispose(); }
                })();
                return {};
            } },
            { token: tenant, lifetime: 'scoped', factory: (_scope, identity) => ({ tenant: identity.tenantId }) }
        ]);
        const alpha = registry.createScope(serviceContext('alpha'));
        try {
            await alpha.resolve(origin);
            await started.promise;
            await alpha.dispose();
            released.release();
            tenantId = await beforeDeadline(detached, 'detached scoped owner');
        } finally { released.release(); await registry.dispose(); }
    });
    it('should use the manual scope identity without carrying its settled ancestor', () => tenantId!.should.equal('beta'));
});
