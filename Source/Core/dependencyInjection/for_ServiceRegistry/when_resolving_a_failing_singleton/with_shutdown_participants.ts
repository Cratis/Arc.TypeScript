// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when a singleton factory fails with shutdown participants', () => {
    let events: string[];
    let failure: unknown;
    beforeEach(async () => {
        events = [];
        const live = serviceToken<object>('live'); const broken = serviceToken<object>('broken');
        const registry = new ServiceRegistry([
            { token: live, lifetime: ServiceLifetime.Singleton, factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) },
            { token: broken, lifetime: ServiceLifetime.Singleton, factory: () => { throw new Error('construction failed'); } }
        ]);
        registry.addShutdownParticipant({ stop: () => { events.push('stop'); }, drain: async () => { events.push('drain'); } });
        const scope = registry.createScope(serviceContext('tenant'));
        await scope.resolve(live);
        await captureFailure(scope.resolve(broken));
        failure = await beforeDeadline(captureFailure(registry.dispose()), 'singleton failure shutdown');
    });
    it('should stop and drain before disposing the singleton', () => events.should.deep.equal(['stop', 'drain', 'singleton disposed']));
    it('should still finish the shutdown', () => (failure === undefined).should.be.true);
});
