// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();

const transportError = new Error('synchronous transport failure');
const disposalError = new Error('singleton disposal failure');

async function disposeWithSynchronousTransportFailure(withParticipant: boolean, disposalFails: boolean) {
    const state = { disposed: false, failure: undefined as unknown };
    const token = serviceToken<object>('singleton');
    const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Singleton,
        factory: () => ({ [Symbol.dispose]: () => {
            state.disposed = true;
            if (disposalFails) throw disposalError;
        } }) }] });
    await server.services.singletonScope().resolve(token);
    if (withParticipant) server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
    server.closeWebSockets = () => { throw transportError; };
    state.failure = await captureFailure(server.dispose());
    return state;
}

const leaves = (value: unknown): unknown[] =>
    value instanceof AggregateError ? value.errors.flatMap(leaves) : [value];

for (const withParticipant of [false, true]) {
    const variant = withParticipant ? 'with participants' : 'without participants';

    describe(`when transport teardown throws synchronously ${variant}`, () => {
        let result: { disposed: boolean; failure: unknown };
        beforeEach(async () => { result = await disposeWithSynchronousTransportFailure(withParticipant, false); });
        it('should dispose the owned singleton', () => result.disposed.should.be.true);
        it('should report the transport failure', () => leaves(result.failure).should.deep.equal([transportError]));
    });

    describe(`when transport teardown throws synchronously and singleton disposal fails ${variant}`, () => {
        let result: { disposed: boolean; failure: unknown };
        beforeEach(async () => { result = await disposeWithSynchronousTransportFailure(withParticipant, true); });
        it('should dispose the owned singleton', () => result.disposed.should.be.true);
        it('should report both failures together', () => {
            (result.failure as AggregateError).should.be.instanceOf(AggregateError);
            leaves(result.failure).should.have.members([transportError, disposalError]);
        });
    });
}
