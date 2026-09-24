// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { queryContext } from './given/a_query_context.js';

should();

describe('when a producer ignores cancellation', () => {
    let error: unknown;

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Stuck', schema: z.object({}), observe: () => (async function* () {
                yield 1;
                await new Promise<void>(() => {});
            })()
        })] });
        const session = await server.openObservableQuery('Stuck', {}, queryContext());
        const stream = session.results();
        await stream.next();
        const pending = stream.next().catch(() => undefined);
        try { await session.close(); } catch (reason) { error = reason; }
        await pending;
        await server.dispose();
    });

    it('should report failed cleanup', () => {
        (error instanceof Error).should.be.true;
        (error as Error).message.should.match(/cleanup failed/);
    });
});
