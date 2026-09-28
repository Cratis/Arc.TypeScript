// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when owned work disposes its server and there are no participants', () => {
    let events: string[];
    let failure: unknown;
    let settled: string[];
    beforeEach(async () => {
        events = [];
        const server = new ArcServer({});
        server.closeWebSockets = async () => { events.push('transport closed'); };
        const scope = server.services.createScope(serviceContext('tenant'));
        try {
            failure = await beforeDeadline(captureFailure(server.runInScope(scope, () => server.dispose())), 'self disposal');
            events.push('self disposal settled');
            settled = [...events];
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should close transports before rejecting the self-join', () =>
        settled.should.deep.equal(['transport closed', 'self disposal settled']));
    it('should reject the self-join', () =>
        (failure as Error).message.should.match(/Cannot await service registry disposal from owned work/));
});
