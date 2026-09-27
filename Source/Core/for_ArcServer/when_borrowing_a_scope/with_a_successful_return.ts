// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when borrowed execution succeeds before registry shutdown', () => {
    let result: string;
    let shutdownFailure: unknown;
    let disposed: boolean;
    beforeEach(async () => {
        disposed = false;
        const resource = serviceToken<object>('borrowed resource');
        const server = new ArcServer({ services: [
            { token: resource, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.dispose]: () => { disposed = true; } }) }
        ] });
        const scope = server.services.createScope(serviceContext('tenant'));
        try {
            result = await beforeDeadline(server.runInScope(scope, async () => {
                await scope.resolve(resource);
                return 'borrowed value';
            }), 'successful borrowed execution');
            shutdownFailure = await beforeDeadline(captureFailure(server.services.dispose()), 'borrowed shutdown');
        } finally { await beforeDeadline(server.dispose(), 'borrowed cleanup'); }
    });
    it('should return the callback value', () => result.should.equal('borrowed value'));
    it('should complete shutdown and dispose the borrowed scope', () => {
        (shutdownFailure === undefined).should.equal(true);
        disposed.should.equal(true);
    });
});
