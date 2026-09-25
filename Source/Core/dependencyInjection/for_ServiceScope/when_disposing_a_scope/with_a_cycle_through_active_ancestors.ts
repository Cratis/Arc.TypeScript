// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceScope } from '../../ServiceScope.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a scope with a cycle through active ancestors', () => {
    let cycleFailure: unknown;
    let completedDetachedDisposal: boolean;
    beforeEach(async () => {
        const first = serviceToken<object>('first'); const second = serviceToken<object>('second');
        const release = gate(); let detached!: Promise<void>; let a!: ServiceScope; let b!: ServiceScope;
        const registry = new ServiceRegistry([
            { token: first, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.asyncDispose]: async () => {
                await b.dispose();
                detached = (async () => { await release.promise; await a.dispose(); })();
            } }) },
            { token: second, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.asyncDispose]: async () => {
                cycleFailure = await captureFailure(a.dispose());
            } }) }
        ]);
        try {
            a = registry.createScope(serviceContext('a')); b = registry.createScope(serviceContext('b'));
            await a.resolve(first); await b.resolve(second);
            await beforeDeadline(a.dispose(), 'active disposal ancestry');
            release.release();
            await beforeDeadline(detached, 'settled detached disposal ancestry');
            completedDetachedDisposal = true;
        } finally { release.release(); await registry.dispose(); }
    });
    it('should reject an active ancestor cycle', () => (cycleFailure as Error).message.should.match(/Cannot await/));
    it('should allow detached settled disposer ancestry', () => completedDetachedDisposal.should.be.true);
});
