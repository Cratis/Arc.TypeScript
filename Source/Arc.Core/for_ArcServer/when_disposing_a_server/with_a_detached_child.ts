// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a server with a detached child', () => {
    let parentSuccess: boolean;
    let childSuccess: boolean;
    let nestedFailure: unknown;
    beforeEach(async () => {
        const entered = gate(); const release = gate();
        let child!: Promise<Awaited<ReturnType<ArcServer['performQuery']>>>;
        const server = new ArcServer({ queries: [
            defineQuery({ name: 'Parent', schema: z.object({}), perform: () => {
                child = server.performQuery('Child', {}, serviceContext('child'));
                return 'parent';
            } }),
            defineQuery({ name: 'Child', schema: z.object({}), perform: async () => {
                entered.release(); await release.promise;
                nestedFailure = await captureFailure(server.performQuery('Child', {}, serviceContext('nested')));
                return 'child';
            } })
        ] });
        try {
            const parent = await server.performQuery('Parent', {}, serviceContext('parent'));
            parentSuccess = parent.isSuccess;
            await entered.promise;
            const closing = server.dispose();
            release.release();
            childSuccess = (await beforeDeadline(child, 'detached child')).isSuccess;
            await beforeDeadline(closing, 'detached child shutdown');
        } finally { release.release(); await server.dispose(); }
    });
    it('should finish admitted parent and child work', () => {
        parentSuccess.should.equal(true);
        childSuccess.should.equal(true);
    });
    it('should reject nested admission after shutdown', () => (nestedFailure as Error).message.should.match(/disposed/));
});
