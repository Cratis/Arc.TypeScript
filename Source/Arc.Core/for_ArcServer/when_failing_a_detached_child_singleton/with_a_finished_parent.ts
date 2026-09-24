// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when failing a detached child singleton with a finished parent', () => {
    let parentData: unknown; let childSuccess: boolean; let childData: unknown; let childMessages: string; let events: string[]; let disposalFailure: unknown;
    beforeEach(async () => {
        const partial = serviceToken<object>('late partial singleton'); const broken = serviceToken<object>('late broken singleton');
        events = []; const started = gate(); const release = gate();
        let child: Promise<Awaited<ReturnType<ArcServer['performQuery']>>> | undefined;
        const server = new ArcServer({ services: [
            { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('partial disposed'); throw new Error('late cleanup failed'); } }) },
            { token: broken, lifetime: 'singleton', dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial); started.release(); await release.promise; throw new Error('late factory failed');
            } }
        ], queries: [
            defineQuery({ name: 'Parent', schema: z.object({}), perform: () => {
                child = server.performQuery('Child', {}, serviceContext('child')); return 'parent finished';
            } }),
            defineQuery({ name: 'Child', schema: z.object({}), handlerDependencies: [broken], perform: () => { events.push('child handler'); return 'unexpected'; } })
        ] });
        try {
            const parentWork = server.performQuery('Parent', {}, serviceContext('parent'));
            await beforeDeadline(started.promise, 'late child factory start');
            parentData = (await beforeDeadline(parentWork, 'late parent completion')).data;
            release.release();
            const result = await beforeDeadline(child!, 'late child shutdown');
            childSuccess = result.isSuccess; childData = result.data; childMessages = result.exceptionMessages.join(' ');
        } finally { release.release(); disposalFailure = await captureFailure(beforeDeadline(server.dispose(), 'late child disposal')); }
    });
    it('should leave the completed parent intact and fail the child without running its handler', () => {
        (parentData as string).should.equal('parent finished'); childSuccess.should.equal(false);
        (childData === undefined).should.equal(true);
        childMessages.should.match(/Service registry disposal failed/);
        events.should.deep.equal(['partial disposed']);
    });
    it('should retain the singleton cleanup error for external shutdown', () => (disposalFailure as Error).message.should.match(/Service registry disposal failed/));
});
