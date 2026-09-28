// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when transport and a separate disposer throw equal primitive failures', () => {
    let failure: AggregateError;
    beforeEach(async () => {
        const token = serviceToken<object>('singleton');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Singleton,
            factory: () => ({ [Symbol.dispose]: () => { throw 'busy'; } }) }] });
        await server.services.singletonScope().resolve(token);
        server.closeWebSockets = () => { throw 'busy'; };
        failure = await captureFailure(server.dispose()) as AggregateError;
    });
    it('should retain both independently originating failures', () => {
        failure.errors.should.deep.equal(['busy', 'busy']);
    });
});
