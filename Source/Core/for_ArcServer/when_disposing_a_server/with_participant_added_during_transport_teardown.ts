// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a participant registers during participant-free observable teardown', () => {
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
    it('should reject late participants while preserving main\'s service admission until registry disposal', () => {
        (registrationFailure as Error).message.should.equal('Service registry is disposed');
        should().equal(scopeFailure, undefined);
        should().equal(executionFailure, undefined);
        events.should.deep.equal(['websockets closed']);
    });
});

describe('when a participant is registered before observable teardown', () => {
    let failures: unknown[];
    beforeEach(async () => {
        const entered = gate(); const release = gate();
        const server = new ArcServer({});
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
        server.closeWebSockets = async () => { entered.release(); await release.promise; };
        try {
            const closing = server.dispose();
            await beforeDeadline(entered.promise, 'participant transport teardown entry');
            failures = [
                await captureFailure(Promise.resolve().then(() => server.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} }))),
                await captureFailure(Promise.resolve().then(() => server.services.createScope(serviceContext('late')))),
                await captureFailure(server.services.runExecution(async () => undefined))
            ];
            release.release();
            await beforeDeadline(closing, 'participant transport shutdown');
        } finally { release.release(); }
    });
    it('should reject new participants, scopes and executions before transport finishes', () => {
        for (const failure of failures) (failure as Error).message.should.equal('Service registry is disposed');
    });
});
