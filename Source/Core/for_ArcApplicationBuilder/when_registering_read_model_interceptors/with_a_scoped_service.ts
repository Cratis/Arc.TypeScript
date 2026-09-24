// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { Task } from '../../queries/for_queryRendering/given/Task.js';
import { PublicTaskName } from '../given/PublicTaskName.js';
should();

describe('when registering read-model interceptors with a scoped service', () => {
    let data: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder({ queries: [defineQuery({
            name: 'Tasks', schema: z.object({}), perform: () => [new Task('one')]
        })] });
        builder.add(PublicTaskName);
        const app = await builder.build();
        try { data = (await app.server.performQuery('Tasks', {}, {
            correlationId: crypto.randomUUID(), signal: new AbortController().signal, allowedSeverity: 2,
            principal: undefined, tenantId: undefined
        })).data; }
        finally { await app.dispose(); }
    });
    it('should apply the registered interceptor in its service scope', () => {
        (data as Task[])[0]!.name.should.equal('public-one');
    });
});
