// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with an already closing scope', () => {
    let immediatelyDisposed: boolean;
    let first: string;
    let beforeRelease: string[];
    let afterRelease: string[];
    beforeEach(async () => {
        const scoped = serviceToken<object>('closing scoped');
        const singleton = serviceToken<object>('closing singleton');
        const insideDisposer = gate(); const releaseDisposer = gate(); const joined = gate();
        const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.asyncDispose]: async () => {
                insideDisposer.release(); await releaseDisposer.promise; events.push('scope disposed');
            } }) },
            { token: singleton, lifetime: ServiceLifetime.Singleton,
                factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        const original = scope.dispose.bind(scope);
        scope.dispose = () => { joined.release(); return original(); };
        try {
            await scope.resolve(scoped);
            await scope.resolve(singleton);
            const closing = scope.dispose();
            immediatelyDisposed = scope.disposed;
            await insideDisposer.promise;
            const shutdown = registry.dispose();
            first = await beforeDeadline(Promise.race([joined.promise.then(() => 'joined'), shutdown.then(() => 'shutdown', () => 'shutdown')]), 'registry joins closing scope');
            beforeRelease = [...events];
            releaseDisposer.release();
            await beforeDeadline(Promise.all([closing, shutdown]), 'scope before singleton shutdown');
            afterRelease = [...events];
        } finally { releaseDisposer.release(); await registry.dispose(); }
    });
    it('should mark the scope disposed immediately', () => immediatelyDisposed.should.equal(true));
    it('should join the closing scope before finishing shutdown', () => {
        first.should.equal('joined');
        beforeRelease.should.deep.equal([]);
    });
    it('should dispose the scope before the singleton', () => afterRelease.should.deep.equal(['scope disposed', 'singleton disposed']));
});
