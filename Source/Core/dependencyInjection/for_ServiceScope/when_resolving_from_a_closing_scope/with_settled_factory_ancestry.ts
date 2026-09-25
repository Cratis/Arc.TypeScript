// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { currentServices } from '../../ServiceScope.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving from a closing scope with settled factory ancestry', () => {
    let resolutionFailure: unknown;
    let ambientFailure: unknown;
    beforeEach(async () => {
        const origin = serviceToken<object>('settled owner'); const dependency = serviceToken<object>('late dependency');
        const release = gate(); let detached!: Promise<void>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: ServiceLifetime.Scoped, factory: resolver => {
                detached = (async () => {
                    await release.promise;
                    resolutionFailure = await captureFailure(Promise.resolve().then(() => resolver.resolve(dependency)));
                    try { currentServices(); } catch (error) { ambientFailure = error; }
                })();
                return {};
            } },
            { token: dependency, lifetime: ServiceLifetime.Scoped, factory: () => ({}) }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        try {
            await scope.resolve(origin);
            await scope.dispose();
            release.release();
            await beforeDeadline(detached, 'settled ancestry');
        } finally { release.release(); await registry.dispose(); }
    });
    it('should not revive the settled factory to resolve from the disposed scope', () => (resolutionFailure as Error).message.should.match(/disposed/));
    it('should not expose an ambient service scope', () => (ambientFailure as Error).message.should.match(/No live/));
});
