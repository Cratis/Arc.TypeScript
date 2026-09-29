// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a nested transport failure and an independent singleton failure have equal primitive values', () => {
    let failure: AggregateError;
    beforeEach(async () => {
        const token = serviceToken<object>('owned');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Singleton,
            factory: () => ({ [Symbol.dispose]: () => { throw 'busy'; } }) }] });
        await server.services.singletonScope().resolve(token);
        server.closeWebSockets = async () => { throw new AggregateError(['busy'], 'transport failed'); };
        failure = await captureFailure(server.dispose()) as AggregateError;
    });
    it('should preserve the independent singleton failure', () => {
        failure.errors.should.have.lengthOf(2);
        (failure.errors[0] as AggregateError).errors.should.deep.equal(['busy']);
        const registryFailure = failure.errors[1] as AggregateError;
        const scopeFailure = registryFailure.errors[0] as AggregateError;
        scopeFailure.errors.should.deep.equal(['busy']);
    });
});
