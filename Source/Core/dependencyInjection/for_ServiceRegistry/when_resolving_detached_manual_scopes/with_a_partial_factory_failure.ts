// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving detached manual scopes with a partial factory failure', () => {
    let failure: unknown;
    let calls: string[];
    beforeEach(async () => {
        const origin = serviceToken<object>('origin');
        const partial = serviceToken<object>('partial');
        const broken = serviceToken<object>('broken');
        const released = gate(); calls = [];
        let detached!: Promise<unknown>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: ServiceLifetime.Scoped, factory: () => {
                detached = (async () => {
                    await released.promise;
                    const manual = registry.createScope(serviceContext('beta'));
                    return manual.resolve(broken);
                })();
                return {};
            } },
            { token: partial, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.dispose]: () => { calls.push('disposed'); } }) },
            { token: broken, lifetime: ServiceLifetime.Scoped, dependencies: [partial], factory: async scope => {
                await scope.resolve(partial);
                throw new Error('broken');
            } }
        ]);
        const alpha = registry.createScope(serviceContext('alpha'));
        try {
            await alpha.resolve(origin);
            await alpha.dispose();
            released.release();
            failure = await captureFailure(beforeDeadline(detached, 'detached manual cleanup'));
        } finally { released.release(); await registry.dispose(); }
    });
    it('should reject the failed factory after cleaning partial manual resources', () => {
        (failure as Error).message.should.match(/factory failed/);
        calls.should.deep.equal(['disposed']);
    });
});
