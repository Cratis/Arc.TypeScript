// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with an abandoned failing factory', () => {
    let shutdownFailure: unknown;
    let repeatedFailure: unknown;
    let singletonFailed: boolean;
    let events: string[];
    beforeEach(async () => {
        const partial = serviceToken<object>('partial'); const broken = serviceToken<object>('broken');
        const entered = gate(); const release = gate(); events = [];
        const registry = new ServiceRegistry([
            { token: partial, lifetime: ServiceLifetime.Singleton, factory: () => ({ [Symbol.dispose]: () => {
                events.push('disposed'); throw new Error('cleanup failed');
            } }) },
            { token: broken, lifetime: ServiceLifetime.Singleton,
                factory: async () => { entered.release(); await release.promise; throw new Error('failed'); } }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        try {
            await scope.resolve(partial);
            void scope.resolve(broken).catch(() => {});
            await entered.promise;
            release.release();
            shutdownFailure = await captureFailure(beforeDeadline(registry.dispose(), 'abandoned failure'));
            singletonFailed = registry.singletonFailed;
            repeatedFailure = await captureFailure(registry.dispose());
        } finally { release.release(); await captureFailure(registry.dispose()); }
    });
    it('should poison the registry and report shutdown failure even without callers', () => {
        singletonFailed.should.equal(true);
        (shutdownFailure as Error).message.should.match(/Service registry disposal failed/);
        (repeatedFailure as Error).message.should.match(/Service registry disposal failed/);
    });
    it('should dispose the partial singleton once', () => events.should.deep.equal(['disposed']));
});
