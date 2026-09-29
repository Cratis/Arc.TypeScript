// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { ServiceDependencyError } from '../../dependencyInjection/ServiceDependencyError.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a server with an in-flight borrowed execution', () => {
    let events: string[];
    let beforeRelease: string[];
    let admissionFailure: unknown;
    let selfJoinFailure: unknown;
    beforeEach(async () => {
        events = [];
        const entered = gate(); const release = gate(); const stopped = gate();
        const scoped = serviceToken<object>('borrowed scoped service');
        const server = new ArcServer({ services: [{ token: scoped, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.dispose]: () => { events.push('scope disposed'); } }) }] });
        const scope = server.services.createScope(serviceContext('tenant'));
        try {
            await scope.resolve(scoped);
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); stopped.release(); },
                drain: async () => { events.push('drain'); } });
            const work = server.runInScope(scope, async () => {
                entered.release(); await release.promise;
                await currentServices().resolve(scoped);
                selfJoinFailure = await captureFailure(server.services.dispose());
                events.push('work settled');
            });
            await beforeDeadline(entered.promise, 'borrowed callback');
            const closing = server.dispose();
            await beforeDeadline(stopped.promise, 'participant stop');
            admissionFailure = await captureFailure(server.runInScope(scope, async () => {}));
            beforeRelease = [...events];
            release.release();
            await beforeDeadline(work, 'borrowed work');
            await beforeDeadline(closing, 'server shutdown');
        } finally { release.release(); await server.dispose(); }
    });
    it('should stop new admission without disposing an admitted scope', () => {
        (admissionFailure instanceof ServiceDependencyError).should.equal(true);
        beforeRelease.should.not.include('scope disposed');
        events.indexOf('work settled').should.be.lessThan(events.indexOf('scope disposed'));
    });
    it('should reject self-joining shutdown from the borrowed execution', () => {
        (selfJoinFailure instanceof ServiceDependencyError).should.equal(true);
        (selfJoinFailure as Error).message.should.match(/Cannot await/);
    });
    it('should stop and drain before disposing the scope', () => {
        events.slice(0, 2).should.deep.equal(['stop', 'drain']);
    });
});
