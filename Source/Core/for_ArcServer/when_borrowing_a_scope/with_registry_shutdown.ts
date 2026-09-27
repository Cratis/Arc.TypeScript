// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when shutdown begins during borrowed execution', () => {
    let events: string[];
    let settledBeforeRelease: boolean;
    beforeEach(async () => {
        events = [];
        const resource = serviceToken<object>('borrowed resource');
        const server = new ArcServer({ services: [
            { token: resource, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); } }) }
        ] });
        const scope = server.services.createScope(serviceContext('tenant'));
        const entered = gate();
        const release = gate();
        try {
            await server.runInScope(scope, () => scope.resolve(resource));
            events.push('first returned');
            const running = server.runInScope(scope, async () => {
                entered.release();
                await release.promise;
                events.push('callback returned');
            });
            await beforeDeadline(entered.promise, 'borrowed callback admission');
            let settled = false;
            const shutdown = server.services.dispose().finally(() => { settled = true; });
            await Promise.resolve();
            settledBeforeRelease = settled;
            release.release();
            await beforeDeadline(Promise.all([running, shutdown]), 'borrowed execution drain');
        } finally { release.release(); await server.dispose(); }
    });
    it('should leave the borrowed scope open on return and drain execution before disposing it', () => {
        settledBeforeRelease.should.equal(false);
        events.should.deep.equal(['first returned', 'callback returned', 'disposed']);
    });
});
