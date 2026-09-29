// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { shutdownArcHost } from '../../http/shutdownArcHost.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when owned work disposes a borrowed-registry server during participant drain', () => {
    let selfJoinFailure: unknown;
    let externalFailure: unknown;
    let hostFailure: unknown;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        const server = new ArcServer({ services: registry });
        const draining = gate(); const joined = gate();
        registry.addShutdownParticipant({ stop: () => {}, drain: async () => { draining.release(); await joined.promise; } });
        const scope = registry.createScope(serviceContext('tenant'));
        try {
            const work = server.runInScope(scope, async () => {
                await draining.promise;
                selfJoinFailure = await captureFailure(server.dispose());
                joined.release();
            });
            const closing = registry.dispose();
            await beforeDeadline(work, 'owned work');
            await beforeDeadline(closing, 'registry shutdown');
            externalFailure = await beforeDeadline(captureFailure(server.dispose()), 'external server disposal');
            hostFailure = await beforeDeadline(captureFailure(shutdownArcHost(server, async () => {}, registry)), 'host shutdown');
        } finally { draining.release(); joined.release(); await scope.dispose(); }
    });
    it('should reject the self-join from owned work', () =>
        (selfJoinFailure as Error).message.should.match(/Cannot await service registry disposal from owned work/));
    it('should resolve a later external server disposal', () => should().equal(externalFailure, undefined));
    it('should resolve a later host shutdown with the registry', () => should().equal(hostFailure, undefined));
});
