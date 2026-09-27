// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { alias, pgTable, text } from 'drizzle-orm/pg-core';
import { postgresqlChangeTrigger } from '../../postgresqlChangeTrigger.js';

const table = pgTable('tasks', { id: text('id').primaryKey() });

describe('when generating a trigger for an aliased PostgreSQL table', () => {
    it('should reject the alias instead of targeting its name', () =>
        (() => postgresqlChangeTrigger(alias(table, 'other_tasks'), { schema: 'app' })).should.throw('aliased'));
});
