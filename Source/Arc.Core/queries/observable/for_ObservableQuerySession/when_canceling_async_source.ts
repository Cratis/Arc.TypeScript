// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { queryContext } from './given/a_query_context.js';

should();

describe('when canceling an async observable source', () => {
    let first: number | undefined;
    let released: boolean;

    beforeEach(async () => {
        released = false;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Sequence', schema: z.object({}), observe: () => (async function* () {
                try { yield 1; yield 2; }
                finally { released = true; }
            })()
        })] });
        const session = await server.openObservableQuery('Sequence', {}, queryContext());
        const stream = session.results();
        first = (await stream.next()).value?.data;
        await stream.return(undefined);
        await server.dispose();
    });

    it('should iterate the first emission', () => { first?.should.equal(1); });
    it('should release the source', () => { released.should.be.true; });
});
