// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { given } from '../../given.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when querying a page and the unpaged count exceeds the limit', given(a_sqlite_database, context => {
    let response: Response;
    let result: { validationResults: unknown[] };
    beforeEach(async () => {
        await context.establish();
        const models = new DrizzleReadModels(context.database, context.table, TaskRecord, 1);
        const server = new ArcServer({ queries: [defineQuery({ name: 'Tasks', schema: z.object({}),
            perform: (_input, _context, options) => models.queryPage(undefined, options) })] });
        try {
            response = (await server.handle(new Request('http://localhost/api/tasks')))!;
            result = await response.json();
        } finally { await server.dispose(); }
    });
    afterEach(() => context.close());
    it('should return a client error rather than a server error', () => response.status.should.equal(400));
    it('should report the paging requirement', () => result.validationResults.should.deep.equal([
        { severity: 3, message: 'The result exceeds the maximum page size of 1; request paging', members: ['Size'], reason: 'rule' }
    ]));
}));
