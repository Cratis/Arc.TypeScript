// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { queryPage } from '../../QueryPage.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';

should();

describe('when streaming a low-level observable page through SSE', () => {
    let results: { data: { id: string }[]; paging: { totalItems: number; size: number } }[];

    beforeEach(async () => {
        const source = new CurrentValueSubject(queryPage([{ id: 'a' }], 1));
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Items', schema: z.object({}), observe: () => source
        })] });
        const response = await server.handle(new Request('http://localhost/api/items?page=0&pageSize=1', {
            headers: { accept: 'text/event-stream' }
        }));
        const reader = response!.body!.getReader();
        const readFrame = async () => {
            const frame = new TextDecoder().decode((await reader.read()).value);
            return JSON.parse(frame.split('\n').find(line => line.startsWith('data:'))!.slice(5)) as typeof results[number];
        };
        try {
            const first = await readFrame();
            source.next(queryPage([{ id: 'b' }], 2));
            results = [first, await readFrame()];
        } finally { await reader.cancel(); await server.dispose(); }
    });

    it('should deliver the initial and changed page with database totals', () => {
        results.map(result => ({ data: result.data, total: result.paging.totalItems, size: result.paging.size })).should.deep.equal([
            { data: [{ id: 'a' }], total: 1, size: 1 },
            { data: [{ id: 'b' }], total: 2, size: 1 }
        ]);
    });
});
