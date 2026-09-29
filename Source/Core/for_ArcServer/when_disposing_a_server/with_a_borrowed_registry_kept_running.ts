// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a server with a borrowed registry is disposed while the registry keeps running', () => {
    let registry: ServiceRegistry;
    let registration: unknown;
    let stops: number;
    beforeEach(async () => {
        stops = 0;
        registry = new ServiceRegistry();
        const server = new ArcServer({ services: registry });
        await beforeDeadline(server.dispose(), 'borrowed server shutdown');
        try { registry.addShutdownParticipant({ stop: () => { stops++; }, drain: async () => {} }); }
        catch (error) { registration = error; }
        await beforeDeadline(registry.dispose(), 'registry shutdown');
    });
    it('should accept later participants', () => should().equal(registration, undefined));
    it('should stop the later participant with the registry', () => stops.should.equal(1));
});
