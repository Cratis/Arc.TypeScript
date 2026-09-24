// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import type { QueryOptions } from '../../QueryOptions.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { queryContext } from './given/a_query_context.js';

should();

describe('when rendering subscription emissions', () => {
    let first: { data: unknown; paging?: unknown };
    let second: { data: unknown };
    let authorized: number;
    let validated: number;
    let observed: number;
    let captured: QueryOptions | undefined;
    let options: QueryOptions;

    beforeEach(async () => {
        const subject = new CurrentValueSubject([{ id: 'b' }, { id: 'a' }]);
        options = { paging: { page: 0, pageSize: 1 }, sorting: { field: 'id', direction: 'asc' } };
        authorized = 0;
        validated = 0;
        observed = 0;
        captured = undefined;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Items', schema: z.object({ term: z.string() }),
            authorize: () => { authorized++; return true; },
            validate: () => { validated++; return []; },
            observe: (_input, _context, requested) => { observed++; captured = requested; return subject; }
        })] });
        const session = await server.openObservableQuery('Items', { term: 'test' }, queryContext(), options);
        const stream = session.results();
        first = (await stream.next()).value!;
        subject.next([{ id: 'z' }, { id: 'c' }]);
        second = (await stream.next()).value!;
        await session.close();
        await server.dispose();
    });

    it('should sort and page the first emission', () => { (first.data as { id: string }[]).should.deep.equal([{ id: 'a' }]); });
    it('should include paging metadata', () => { (first.paging as { page: number; size: number; totalItems: number; totalPages: number }).should.deep.equal({ page: 0, size: 1, totalItems: 2, totalPages: 2 }); });
    it('should render later emissions with the same options', () => { (second.data as { id: string }[]).should.deep.equal([{ id: 'c' }]); });
    it('should authorize once', () => { authorized.should.equal(1); });
    it('should validate once', () => { validated.should.equal(1); });
    it('should open the source once', () => { observed.should.equal(1); });
    it('should pass options to the source', () => { should().equal(captured, options); });
});
