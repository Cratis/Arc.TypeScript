// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a participant registers during failing transport teardown', () => {
    let failures: unknown[];
    let transportError: Error;
    beforeEach(async () => {
        const entered = gate(); const release = gate();
        const server = new ArcServer({});
        transportError = new Error('websocket teardown failed');
        server.closeWebSockets = async () => { entered.release(); await release.promise; throw transportError; };
        try {
            const closing = captureFailure(server.dispose());
            await beforeDeadline(entered.promise, 'transport entry');
            server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
            release.release();
            const failure = await beforeDeadline(closing, 'late participant transport failure');
            failures = [];
            const visit = (error: unknown): void => {
                if (error instanceof AggregateError) error.errors.forEach(visit);
                else failures.push(error);
            };
            visit(failure);
        } finally { release.release(); }
    });
    it('should report the transport error exactly once', () => {
        failures.should.deep.equal([transportError]);
    });
});
