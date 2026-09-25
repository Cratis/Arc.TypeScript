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
describe('when failing a detached child singleton with a living grandparent', () => {
    let parentData: unknown; let childFailed: boolean; let beforeCleanup: string[];
    let grandparentSuccess: boolean; let grandparentData: unknown; let messages: string; let events: string[]; let disposalFailure: unknown;
    beforeEach(async () => {
        const partial = serviceToken<object>('grandchild partial singleton'); const broken = serviceToken<object>('grandchild broken singleton');
        events = []; const started = gate(); const release = gate(); const parentDone = gate();
        let child: Promise<Awaited<ReturnType<ArcServer['performQuery']>>> | undefined;
        const server = new ArcServer({ services: [
            { token: partial, lifetime: ServiceLifetime.Singleton,
                factory: () => ({ [Symbol.dispose]: () => {
                    events.push('partial disposed'); throw new Error('grandchild cleanup failed');
                } }) },
            { token: broken, lifetime: ServiceLifetime.Singleton, dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial); started.release(); await release.promise; throw new Error('grandchild factory failed');
            } }
        ], queries: [
            defineQuery({ name: 'Grandparent', schema: z.object({}), perform: async () => {
                const parent = await server.performQuery('Parent', {}, serviceContext('parent'));
                parentData = parent.data; parentDone.release();
                childFailed = !(await child!).isSuccess;
                beforeCleanup = [...events];
                return 'must not succeed';
            } }),
            defineQuery({ name: 'Parent', schema: z.object({}), perform: () => {
                child = server.performQuery('Child', {}, serviceContext('child')); return 'parent done';
            } }),
            defineQuery({ name: 'Child', schema: z.object({}), handlerDependencies: [broken], perform: () => { events.push('child handler'); return 'unexpected'; } })
        ] });
        try {
            const grandparent = server.performQuery('Grandparent', {}, serviceContext('grandparent'));
            await beforeDeadline(started.promise, 'grandchild factory start');
            await beforeDeadline(parentDone.promise, 'intermediate parent completion');
            release.release();
            const result = await beforeDeadline(grandparent, 'grandparent shutdown');
            grandparentSuccess = result.isSuccess; grandparentData = result.data; messages = result.exceptionMessages.join(' ');
        } finally { release.release(); disposalFailure = await captureFailure(beforeDeadline(server.dispose(), 'grandparent disposal')); }
    });
    it('should defer cleanup from the finished parent to the living grandparent', () => {
        (parentData as string).should.equal('parent done'); childFailed.should.equal(true);
        beforeCleanup.should.deep.equal([]);
        grandparentSuccess.should.equal(false); (grandparentData === undefined).should.equal(true);
        messages.should.match(/Service registry disposal failed/);
        events.should.deep.equal(['partial disposed']);
    });
    it('should report the cleanup failure to external shutdown', () => (disposalFailure as Error).message.should.match(/Service registry disposal failed/));
});
