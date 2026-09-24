// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with a live root factory', () => {
    let rootAbortedBeforeDrain: boolean;
    let rootAbortedDuringConstruction: boolean;
    let events: string[];
    beforeEach(async () => {
        const origin = serviceToken<object>('origin'); const dependency = serviceToken<object>('dependency');
        const entered = gate(); const release = gate(); events = [];
        const registry = new ServiceRegistry([
            { token: dependency, lifetime: 'singleton', factory: (_resolver, lifetime) => ({
                [Symbol.dispose]: () => { events.push(lifetime.signal.aborted ? 'dependency' : 'dependency not aborted'); }
            }) },
            { token: origin, lifetime: 'singleton', factory: async (resolver, lifetime) => {
                entered.release(); await release.promise;
                rootAbortedDuringConstruction = lifetime.signal.aborted;
                await resolver.resolve(dependency);
                return { [Symbol.dispose]: () => { events.push(lifetime.signal.aborted ? 'origin' : 'origin not aborted'); } };
            } }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        try {
            const work = scope.resolve(origin); await entered.promise;
            const shutdown = registry.dispose();
            rootAbortedBeforeDrain = registry.singletonContext.signal.aborted;
            release.release();
            await beforeDeadline(work, 'root dependency');
            await beforeDeadline(shutdown, 'root shutdown');
        } finally { release.release(); await registry.dispose(); }
    });
    it('should allow construction dependencies before quiescence', () => {
        rootAbortedBeforeDrain.should.equal(false);
        rootAbortedDuringConstruction.should.equal(false);
    });
    it('should abort the root before disposing in reverse dependency order', () => events.should.deep.equal(['origin', 'dependency']));
});
