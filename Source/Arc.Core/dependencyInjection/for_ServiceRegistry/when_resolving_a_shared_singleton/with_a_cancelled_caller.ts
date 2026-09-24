// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { currentContext } from '../../../ArcServer.js';
import { currentServices } from '../../ServiceScope.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving a shared singleton with a cancelled caller', () => {
    let sameInstance: boolean;
    let creations: number;
    let seen: unknown[];
    let failed: boolean;
    beforeEach(async () => {
        const token = serviceToken<object>('shared');
        const entered = gate(); const release = gate();
        const cancelled = new AbortController();
        const alpha = { ...serviceContext('alpha'), signal: cancelled.signal };
        const beta = serviceContext('beta');
        seen = []; creations = 0;
        const registry = new ServiceRegistry([{ token, lifetime: 'singleton', factory: async (resolver, lifetime) => {
            creations++;
            seen.push(Object.isFrozen(lifetime), lifetime === registry.singletonContext, lifetime.signal.aborted,
                lifetime.signal === alpha.signal, lifetime.signal === beta.signal,
                currentContext(), resolver.identity, currentServices().identity);
            entered.release(); await release.promise;
            seen.push(currentContext());
            return {};
        } }]);
        const first = registry.createScope(alpha); const second = registry.createScope(beta);
        try {
            const a = first.resolve(token); await entered.promise;
            cancelled.abort();
            const b = second.resolve(token);
            release.release();
            sameInstance = await a === await b;
            failed = registry.singletonFailed;
        } finally { release.release(); await registry.dispose(); }
    });
    it('should share one factory result across cancelled and active callers', () => {
        sameInstance.should.equal(true);
        creations.should.equal(1);
    });
    it('should use an immutable registry owned lifetime without request authority', () => {
        seen.should.deep.equal([true, true, false, false, false, undefined, undefined, undefined, undefined]);
        failed.should.equal(false);
    });
});
