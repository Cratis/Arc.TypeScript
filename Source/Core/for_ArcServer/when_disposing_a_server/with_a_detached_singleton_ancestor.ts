// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a server with a detached singleton ancestor', () => {
    let startedSuccessfully: boolean;
    let childFailed: boolean;
    let singletonFailed: boolean;
    beforeEach(async () => {
        const token = serviceToken<object>('detached root'); const broken = serviceToken<object>('nested failure');
        const entered = gate(); const release = gate();
        let child!: Promise<Awaited<ReturnType<ArcServer['performQuery']>>>;
        const server = new ArcServer({ services: [
            { token, lifetime: ServiceLifetime.Singleton, factory: async () => {
                entered.release(); await release.promise;
                child = server.performQuery('Broken', {}, serviceContext('nested'));
                childFailed = !(await child).isSuccess;
                throw new Error('root failed after nested');
            } },
            { token: broken, lifetime: ServiceLifetime.Scoped, factory: () => { throw new Error('nested failed'); } }
        ], queries: [
            defineQuery({ name: 'Start', schema: z.object({}), perform: () => {
                void currentServices().resolve(token).catch(() => {});
                return 'started';
            } }),
            defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 'unexpected' })
        ] });
        try {
            startedSuccessfully = (await server.performQuery('Start', {}, serviceContext('parent'))).isSuccess;
            await entered.promise;
            release.release();
            await beforeDeadline(child, 'detached nested failure');
            await beforeDeadline(server.dispose(), 'detached root shutdown');
            singletonFailed = server.services.singletonFailed;
        } finally { release.release(); await server.dispose(); }
    });
    it('should finish the originating execution without joining its detached ancestor', () => startedSuccessfully.should.equal(true));
    it('should report the child failure and poison the singleton root', () => {
        childFailed.should.equal(true);
        singletonFailed.should.equal(true);
    });
});
