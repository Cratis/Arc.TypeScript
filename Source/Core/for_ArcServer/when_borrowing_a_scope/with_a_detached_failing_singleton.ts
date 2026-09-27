// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceDependencyError } from '../../dependencyInjection/ServiceDependencyError.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a detached singleton fails before borrowed execution drains', () => {
    let failure: unknown;
    let poisoned: boolean;
    let shutdownFailure: unknown;
    beforeEach(async () => {
        const broken = serviceToken<object>('broken singleton');
        const server = new ArcServer({ services: [
            { token: broken, lifetime: ServiceLifetime.Singleton, factory: () => { throw new Error('construction failed'); } }
        ] });
        const scope = server.services.createScope(serviceContext('tenant'));
        try {
            failure = await beforeDeadline(captureFailure(server.runInScope(scope, async () => {
                void scope.resolve(broken).catch(() => {});
                await Promise.resolve();
                await Promise.resolve();
                return 'must not publish';
            })), 'detached singleton failure');
            poisoned = server.services.singletonFailed;
            shutdownFailure = await beforeDeadline(captureFailure(server.services.dispose()), 'singleton shutdown');
        } finally { await beforeDeadline(server.dispose(), 'detached singleton cleanup'); }
    });
    it('should reject the borrowed success after registry poisoning', () => {
        poisoned.should.equal(true);
        (failure instanceof ServiceDependencyError).should.equal(true);
        (failure as Error).message.should.equal('Service registry is disposed');
    });
    it('should not join registry disposal from borrowed work', () => (shutdownFailure === undefined).should.equal(true));
});
