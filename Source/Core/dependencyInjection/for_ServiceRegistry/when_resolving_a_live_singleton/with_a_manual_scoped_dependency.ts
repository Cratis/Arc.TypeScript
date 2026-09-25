// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving a live singleton with a manual scoped dependency', () => {
    let failure: unknown;
    beforeEach(async () => {
        const origin = serviceToken<object>('live singleton');
        const scoped = serviceToken<object>('scoped child');
        const registry = new ServiceRegistry([
            { token: origin, lifetime: ServiceLifetime.Singleton, factory: async () => {
                const manual = registry.createScope(serviceContext('beta'));
                try { await manual.resolve(scoped); } finally { await manual.dispose(); }
                return {};
            } },
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: () => ({}) }
        ]);
        try {
            const alpha = registry.createScope(serviceContext('alpha'));
            failure = await captureFailure(beforeDeadline(alpha.resolve(origin), 'live singleton manual scope'));
        } finally { await registry.dispose(); }
    });
    it('should reject the captive resolution without hanging', () => (failure as Error).message.should.match(/Captive/));
});
