// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { PendingTasksRenderer } from '../given/PendingTasksRenderer.js';
import { PublicTaskName } from '../given/PublicTaskName.js';
should();

describe('when registering a discovered renderer and interceptor', () => {
    let data: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder({ queries: [defineQuery({
            name: 'Tasks', schema: z.object({}), perform: () => 'provider'
        })] });
        builder.add(PendingTasksRenderer, PublicTaskName);
        const app = await builder.build();
        try {
            const response = await app.server.handle(new Request('http://localhost/api/tasks'));
            data = (await response!.json()).data;
        } finally { await app.dispose(); }
    });
    it('should render provider data and intercept the model', () => {
        (data as object[]).should.deep.equal([{ name: 'public-one' }]);
    });
});
