// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a transport fails after registry shutdown starts', () => {
    let failure: AggregateError;
    let repeatedFailure: unknown;
    beforeEach(async () => {
        const server = new ArcServer({});
        server.closeWebSockets = async () => { throw new Error('websocket cleanup failed'); };
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
        const closing = server.services.dispose();
        failure = await beforeDeadline(captureFailure(closing), 'registry-first transport failure') as AggregateError;
        repeatedFailure = await captureFailure(server.dispose());
    });
    it('should report the cleanup error to registry and server shutdown callers', () => {
        failure.message.should.equal('Service registry disposal failed');
        (failure.errors[0] as Error).message.should.equal('websocket cleanup failed');
        (repeatedFailure === failure).should.equal(true);
    });
});
