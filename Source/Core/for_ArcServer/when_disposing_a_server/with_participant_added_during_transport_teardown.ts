// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a participant registers during observable teardown', () => {
    let events: string[];
    let registrationFailure: unknown;
    let scopeFailure: unknown;
    let executionFailure: unknown;
    beforeEach(async () => {
        events = [];
        const entered = gate(); const release = gate();
        const server = new ArcServer({});
        server.closeWebSockets = async () => { entered.release(); await release.promise; events.push('websockets closed'); };
        try {
            const closing = server.dispose();
            await beforeDeadline(entered.promise, 'transport teardown entry');
            registrationFailure = await captureFailure(Promise.resolve().then(() => server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} })));
            scopeFailure = await captureFailure(Promise.resolve().then(() => server.services.createScope(serviceContext('late'))));
            executionFailure = await captureFailure(server.services.runExecution(async () => undefined));
            release.release();
            await beforeDeadline(closing, 'transport teardown shutdown');
        } finally { release.release(); }
    });
    it('should close registry admission before awaiting transport teardown', () => {
        for (const failure of [registrationFailure, scopeFailure, executionFailure]) {
            (failure as Error).message.should.equal('Service registry is disposed');
        }
        events.should.deep.equal(['websockets closed']);
    });
});
