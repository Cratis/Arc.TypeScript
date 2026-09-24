// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { queryContext } from './given/a_query_context.js';
import { trackedSource } from './given/a_tracked_source.js';

should();

describe('when the server disposes with an active source', () => {
    let active: number;

    beforeEach(async () => {
        const tracked = trackedSource(new CurrentValueSubject<number>(1));
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const session = await server.openObservableQuery('Value', {}, queryContext());
        await session.results().next();
        await server.dispose();
        active = tracked.count();
    });

    it('should unsubscribe every source', () => { active.should.equal(0); });
});
