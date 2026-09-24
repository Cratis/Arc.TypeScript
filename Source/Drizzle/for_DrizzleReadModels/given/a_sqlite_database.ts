// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Guid } from '@cratis/fundamentals';
import { guidCodec } from '../../ColumnCodec.js';
import { sqliteColumn } from '../../columns.js';

/** A real isolated in-memory SQLite database with the same declared SQL schema. */
export class a_sqlite_database {
    readonly native: Database.Database = new Database(':memory:');
    readonly table = sqliteTable('tasks', {
        id: sqliteColumn(guidCodec('sqlite'))('id').primaryKey(),
        title: text('title').notNull()
    });
    readonly database = drizzle(this.native);
    constructor() {
        this.native.exec('create table tasks (id text primary key, title text not null)');
        this.database.insert(this.table).values({ id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), title: 'z' }).run();
        this.database.insert(this.table).values({ id: Guid.parse('11112233-4455-6677-8899-aabbccddeeff'), title: 'a' }).run();
    }
    close() { this.native.close(); }
}
