// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { an_application_builder } from '../../for_ArcApplicationBuilder/given/an_application_builder.js';

describe('when stopping an application with a caller-owned registry that has a participant', given(an_application_builder, context => {
    let registry: ServiceRegistry;
    let stopped: boolean;
    let participantStopped: boolean;
    let registryDisposed: boolean;
    beforeEach(async () => {
        registry = new ServiceRegistry();
        participantStopped = false;
        registry.addShutdownParticipant({ stop: () => { participantStopped = true; }, drain: async () => {} });
        const application = await context.create({ services: registry }).build();
        let settled = false;
        const running = application.run({ port: 0 }).then(() => { settled = true; });
        await new Promise(resolve => setTimeout(resolve, 50));
        await beforeDeadline(application.stop(), 'application stop');
        await beforeDeadline(running, 'application run');
        stopped = settled;
        registryDisposed = registry.disposed;
    });
    afterEach(async () => { await registry.dispose(); });
    it('should stop the application', () => { stopped.should.equal(true); });
    it('should leave the caller-owned registry running', () => { registryDisposed.should.equal(false); });
    it('should leave participant stop to the registry owner', () => { participantStopped.should.equal(false); });
}));
