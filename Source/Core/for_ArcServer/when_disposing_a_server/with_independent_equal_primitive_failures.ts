// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when transport throws synchronously without shutdown participants', () => {
    let failure: unknown;
    let disposed: boolean;
    let disposedAtFirstOutcome: boolean;
    beforeEach(async () => {
        disposed = false;
        const token = serviceToken<object>('singleton');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Singleton,
            factory: () => ({ [Symbol.dispose]: () => { disposed = true; } }) }] });
        await server.services.singletonScope().resolve(token);
        server.closeWebSockets = () => { throw 'busy'; };
        failure = await captureFailure(server.dispose());
        disposedAtFirstOutcome = disposed;
        await server.services.dispose();
    });
    it('should report the transport error after disposing owned singletons', () => {
        should().equal(failure, 'busy');
        disposedAtFirstOutcome.should.equal(true);
        disposed.should.equal(true);
    });
});

describe('when transport and a separate disposer throw equal primitives with participants', () => {
    let failure: AggregateError;
    beforeEach(async () => {
        const token = serviceToken<object>('singleton');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Singleton,
            factory: () => ({ [Symbol.dispose]: () => { throw 'busy'; } }) }] });
        await server.services.singletonScope().resolve(token);
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
        server.closeWebSockets = async () => { throw 'busy'; };
        failure = await captureFailure(server.dispose()) as AggregateError;
    });
    it('should retain both independently originating failures', () => {
        failure.errors.should.have.lengthOf(2);
        failure.errors[0].should.equal('busy');
        ((failure.errors[1] as AggregateError).errors[0] as string).should.equal('busy');
    });
});
