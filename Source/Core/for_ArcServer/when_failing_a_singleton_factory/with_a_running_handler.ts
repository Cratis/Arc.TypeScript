// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when failing a singleton factory with a running handler', () => {
    let poisoned: boolean; let beforeDrain: string[]; let newWorkFailure: unknown;
    let slowSuccess: boolean; let slowData: unknown; let brokenSuccess: boolean; let events: string[];
    beforeEach(async () => {
        const active = serviceToken<object>('active'); const broken = serviceToken<object>('broken');
        events = []; const running = gate(); const release = gate(); const failed = gate();
        const server = new ArcServer({ services: [
            { token: active, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); } }) },
            { token: broken, lifetime: ServiceLifetime.Singleton, factory: () => { throw new Error('failed'); } }
        ], queries: [
            defineQuery({ name: 'Slow', schema: z.object({}), handlerDependencies: [active], perform: async () => {
                running.release(); await release.promise; events.push('resumed'); return 'sensitive';
            } }),
            defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 1 })
        ] });
        const markFailure = server.services.markSingletonFailure.bind(server.services);
        server.services.markSingletonFailure = () => { markFailure(); failed.release(); };
        try {
            const slow = server.performQuery('Slow', {}, serviceContext('alpha'));
            await running.promise;
            const failure = server.performQuery('Broken', {}, serviceContext('beta'));
            await beforeDeadline(failed.promise, 'concurrent singleton failure signal');
            poisoned = server.services.singletonFailed; beforeDrain = [...events];
            newWorkFailure = await captureFailure(server.performQuery('Slow', {}, serviceContext('new')));
            release.release();
            const result = await slow;
            slowSuccess = result.isSuccess; slowData = result.data;
            brokenSuccess = (await failure).isSuccess;
        } finally { release.release(); await server.dispose(); }
    });
    it('should drain without disposing an active handler prematurely or accepting new work', () => {
        poisoned.should.equal(true); beforeDrain.should.deep.equal([]);
        (newWorkFailure as Error).message.should.match(/disposed/);
    });
    it('should fail both responses and dispose the active scope after it resumes', () => {
        slowSuccess.should.equal(false); (slowData === undefined).should.equal(true);
        brokenSuccess.should.equal(false); events.should.deep.equal(['resumed', 'disposed']);
    });
});
