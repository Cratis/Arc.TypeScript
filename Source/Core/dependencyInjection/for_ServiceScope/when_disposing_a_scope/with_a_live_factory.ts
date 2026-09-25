// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a scope with a live factory', () => {
    let prematureFailure: unknown;
    let laterFailure: unknown;
    let rootAbortedBeforeDrain: boolean;
    let events: string[];
    beforeEach(async () => {
        const scoped = serviceToken<object>('scoped'); const singleton = serviceToken<object>('singleton');
        const entered = gate(); const release = gate(); events = [];
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: async resolver => {
                entered.release(); await release.promise;
                await resolver.resolve(singleton);
                return {};
            } },
            { token: singleton, lifetime: ServiceLifetime.Singleton, factory: (_resolver, lifetime) => ({
                [Symbol.dispose]: () => { events.push(lifetime.signal.aborted ? 'disposed' : 'not aborted'); }
            }) }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        try {
            const work = scope.resolve(scoped);
            await entered.promise;
            const closing = scope.dispose();
            prematureFailure = await captureFailure(Promise.resolve().then(() => scope.resolve(singleton)));
            const shutdown = registry.dispose();
            rootAbortedBeforeDrain = registry.singletonContext.signal.aborted;
            release.release();
            await beforeDeadline(work, 'closing scoped factory');
            await beforeDeadline(Promise.all([closing, shutdown]), 'closing scoped shutdown');
            laterFailure = await captureFailure(Promise.resolve().then(() => scope.resolve(singleton)));
        } finally { release.release(); await registry.dispose(); }
    });
    it('should allow only the live factory to resolve a dependency while closing', () => {
        (prematureFailure as Error).message.should.match(/disposed/);
        (laterFailure as Error).message.should.match(/disposed/);
    });
    it('should retain the root signal until draining and abort it before disposal', () => {
        rootAbortedBeforeDrain.should.equal(false);
        events.should.deep.equal(['disposed']);
    });
});
