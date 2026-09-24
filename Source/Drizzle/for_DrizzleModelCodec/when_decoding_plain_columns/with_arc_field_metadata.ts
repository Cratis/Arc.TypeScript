// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Guid } from '@cratis/fundamentals';
import { DrizzleModelCodec } from '../../DrizzleModelCodec.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';

should();
describe('when decoding plain SQL columns with Arc field metadata', () => {
    it('should materialize a declared Fundamentals GUID even without a custom column', () => {
        const table = sqliteTable('records', { id: text('id').primaryKey(), title: text('title') });
        const codec = new DrizzleModelCodec(TaskRecord, getTableColumns(table));
        const record = codec.deserialize({ id: '00112233-4455-6677-8899-aabbccddeeff', title: 'item' });
        record.id.should.be.instanceOf(Guid);
        record.title.should.equal('item');
    });
    it('should reject a table that omits a declared read-model field', () => {
        const table = sqliteTable('records', { id: text('id').primaryKey() });
        (() => new DrizzleModelCodec(TaskRecord, getTableColumns(table))).should.throw('no column for field: title');
    });
});
