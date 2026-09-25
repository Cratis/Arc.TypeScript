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
describe('when resolving a singleton with a detached child after factory completion', () => {
    let parentSuccess: boolean; let parentData: unknown; let childSuccess: boolean; let childData: unknown; let constructions: number;
    beforeEach(async () => {
        const singleton = serviceToken<object>('completed singleton');
        const entered = gate(); const release = gate();
        let child: Promise<Awaited<ReturnType<ArcServer['performQuery']>>> | undefined;
        constructions = 0; const value = {};
        const server = new ArcServer({ services: [{ token: singleton, lifetime: ServiceLifetime.Singleton, factory: () => {
            constructions++; child = server.performQuery('Child', {}, serviceContext('child'));
            return value;
        } }], queries: [
            defineQuery({ name: 'Parent', schema: z.object({}), handlerDependencies: [singleton], perform: () => 'parent done' }),
            defineQuery({ name: 'Child', schema: z.object({}), perform: async () => {
                entered.release(); await release.promise;
                return (await currentServices().resolve(singleton)) === value;
            } })
        ] });
        try {
            const parentWork = server.performQuery('Parent', {}, serviceContext('parent'));
            await beforeDeadline(entered.promise, 'detached child start');
            const parent = await beforeDeadline(parentWork, 'completed singleton parent');
            parentSuccess = parent.isSuccess; parentData = parent.data;
            release.release();
            const result = await beforeDeadline(child!, 'completed singleton child');
            childSuccess = result.isSuccess; childData = result.data;
        } finally { release.release(); await beforeDeadline(server.dispose(), 'completed singleton disposal'); }
    });
    it('should preserve the finished parent and let its detached child reuse the singleton', () => {
        parentSuccess.should.equal(true); (parentData as string).should.equal('parent done');
        childSuccess.should.equal(true); (childData as boolean).should.equal(true);
        constructions.should.equal(1);
    });
});
