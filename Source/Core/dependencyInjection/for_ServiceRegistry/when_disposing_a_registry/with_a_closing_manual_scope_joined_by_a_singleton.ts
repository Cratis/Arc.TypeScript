// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceScope } from '../../ServiceScope.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with a closing manual scope joined by a singleton', () => {
    let events: string[];
    beforeEach(async () => {
        const root = serviceToken<object>('root'); const resource = serviceToken<object>('manual resource');
        const entered = gate(); const release = gate(); events = [];
        let manual!: ServiceScope;
        const registry = new ServiceRegistry([
            { token: resource, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.asyncDispose]: async () => {
                entered.release(); await release.promise; events.push('manual');
            } }) },
            { token: root, lifetime: ServiceLifetime.Singleton, factory: () => ({ [Symbol.asyncDispose]: async () => {
                await manual.dispose(); events.push('root');
            } }) }
        ]);
        try {
            manual = registry.createScope(serviceContext('manual'));
            await manual.resolve(resource);
            await manual.resolve(root);
            const closing = manual.dispose();
            await entered.promise;
            const shutdown = registry.dispose();
            release.release();
            await beforeDeadline(Promise.all([closing, shutdown]), 'singleton joining manual scope');
        } finally { release.release(); await registry.dispose(); }
    });
    it('should finish the manual scope before disposing the singleton', () => events.should.deep.equal(['manual', 'root']));
});
