// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when transport and an empty aggregate singleton disposer fail', () => {
    let failure: AggregateError;
    let singletonError: AggregateError;
    let transportError: Error;
    beforeEach(async () => {
        singletonError = new AggregateError([], 'singleton failed');
        transportError = new Error('socket failed');
        const token = serviceToken<object>('singleton');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Singleton,
            factory: () => ({ [Symbol.dispose]: () => { throw singletonError; } }) }] });
        await server.services.singletonScope().resolve(token);
        server.closeWebSockets = async () => { throw transportError; };
        failure = await captureFailure(server.dispose()) as AggregateError;
    });
    it('should report both the transport failure and the empty aggregate', () => {
        failure.errors.should.include(transportError);
        failure.errors.should.include(singletonError);
        failure.errors.should.have.lengthOf(2);
    });
});
