// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { queryContext } from './given/a_query_context.js';

should();

describe('when consuming the same subscription twice', () => {
    let error: unknown;

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => new CurrentValueSubject(1)
        })] });
        const session = await server.openObservableQuery('Value', {}, queryContext());
        const stream = session.results();
        try { session.results(); } catch (reason) { error = reason; }
        await stream.return(undefined);
        await server.dispose();
    });

    it('should reject the second consumer', () => {
        (error instanceof Error).should.be.true;
        (error as Error).message.should.match(/already consumed/);
    });
});
