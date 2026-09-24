// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { queryContext } from './given/a_query_context.js';

should();

describe('when canceling a cooperative async producer', () => {
    let released: boolean;

    beforeEach(async () => {
        released = false;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: (_input, execution) => (async function* () {
                try {
                    yield 1;
                    await new Promise<void>(resolve => execution.signal.addEventListener('abort', () => resolve(), { once: true }));
                } finally { released = true; }
            })()
        })] });
        const session = await server.openObservableQuery('Value', {}, queryContext());
        const stream = session.results();
        await stream.next();
        const pending = stream.next();
        await session.close();
        await pending;
        await server.dispose();
    });

    it('should release the blocked producer', () => { released.should.equal(true); });
});
