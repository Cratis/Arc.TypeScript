// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleHandle } from '../DrizzleHandle.js';
import { given } from '../given.js';
import { a_notification_bus, table } from './given/a_notification_bus.js';

describe('when a different table object with the same name is announced', given(a_notification_bus, context => {
    let notify: () => void;
    beforeEach(() => {
        const handle = new DrizzleHandle({}, context.bus, 'a');
        const other = sqliteTable('tasks', { id: text('id').primaryKey() });
        notify = () => handle.notifyChanged(other);
    });
    it('should reject the unregistered identity', () => { notify.should.throw('Unknown Drizzle read-model table: tasks'); });
}));

describe('when a registered table is announced outside a command', given(a_notification_bus, context => {
    beforeEach(() => { context.hits.length = 0; new DrizzleHandle({}, context.bus, 'a').notifyChanged(table); });
    it('should publish immediately', () => { context.hits.should.deep.equal(['a']); });
}));
