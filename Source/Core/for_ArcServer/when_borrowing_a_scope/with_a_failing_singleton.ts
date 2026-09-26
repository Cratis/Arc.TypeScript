// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when singleton construction fails inside borrowed work', () => {
    let failure: unknown;
    let shutdownFailure: unknown;
    beforeEach(async () => {
        const broken = serviceToken<object>('broken singleton');
        const server = new ArcServer({ services: [
            { token: broken, lifetime: ServiceLifetime.Singleton, factory: () => { throw new Error('construction failed'); } }
        ] });
        const scope = server.services.createScope(serviceContext('tenant'));
        // The callback catches the factory error; the borrowed boundary must still report registry poisoning.
        failure = await beforeDeadline(captureFailure(server.runInScope(scope, async () => {
            await captureFailure(scope.resolve(broken));
            return 'must not publish';
        })), 'borrowed singleton failure');
        shutdownFailure = await beforeDeadline(captureFailure(server.services.dispose()), 'singleton shutdown');
    });
    it('should reject the borrowed success without joining its own shutdown', () => {
        (failure as Error).message.should.equal('Service registry is disposed');
        (shutdownFailure === undefined).should.equal(true);
    });
});
