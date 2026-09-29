// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { trackedSource } from '../../queries/observable/for_ObservableQuerySession/given/a_tracked_source.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
for (const participants of [false, true]) {
    for (const singletonFailure of [false, true]) {
        describe(`when a host ${singletonFailure ? 'fails a singleton' : 'closes the registry'} before server disposal ${participants ? 'with' : 'without'} participants`, () => {
            let active: number;
            beforeEach(async () => {
                const token = serviceToken<object>('failing singleton');
                const registry = new ServiceRegistry([{ token, lifetime: ServiceLifetime.Singleton,
                    factory: () => { throw new Error('factory failed'); } }]);
                const tracked = trackedSource(new CurrentValueSubject(1));
                const server = new ArcServer({ services: registry, observableQueries: [defineObservableQuery({
                    name: 'Live', schema: z.object({}), observe: () => tracked
                })] });
                const session = await server.openObservableQuery('Live', {}, observableExecution());
                await session.results().next();
                if (participants) registry.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
                if (singletonFailure) await captureFailure(registry.singletonScope().resolve(token));
                await beforeDeadline(registry.dispose(), 'host registry disposal');
                await beforeDeadline(server.dispose(), 'server disposal after host registry');
                active = tracked.count();
            });
            it('should unsubscribe the active source', () => { active.should.equal(0); });
        });
    }
}
