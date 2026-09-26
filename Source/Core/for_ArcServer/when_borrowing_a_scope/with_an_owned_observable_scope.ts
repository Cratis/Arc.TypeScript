// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();
describe('when borrowing an Arc-owned observable scope', () => {
    let failure: unknown;
    let callbacks: number;
    beforeEach(async () => {
        callbacks = 0;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'OwnedObservable', schema: z.object({}), observe: async () => {
                failure = await captureFailure(server.runInScope(currentServices(), () => { callbacks++; }));
                return new CurrentValueSubject('ready');
            }
        })] });
        try {
            const session = await server.openObservableQuery('OwnedObservable', {}, { ...serviceContext('tenant'),
                principal: { id: 'caller', isAuthenticated: true, roles: ['Reader'] } });
            await session.close();
        } finally { await server.dispose(); }
    });
    it('should reject borrowing before calling back', () => {
        (failure as Error).message.should.contain('unsnapshotable principal');
        callbacks.should.equal(0);
    });
});
