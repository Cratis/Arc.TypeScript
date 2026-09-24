// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { Guid } from '@cratis/fundamentals';
import { guidCodec } from '../../ColumnCodec.js';
import { sqliteColumn } from '../../columns.js';

/** An isolated in-memory SQLite database running in WebAssembly (no native binding). */
export class a_sqlite_database {
    native!: Database;
    readonly table = sqliteTable('tasks', {
        id: sqliteColumn(guidCodec('sqlite'))('id').primaryKey(),
        title: text('title').notNull()
    });
    database!: ReturnType<typeof drizzle>;
    async establish() {
        const SQL = await initSqlJs();
        this.native = new SQL.Database();
        this.database = drizzle(this.native);
        this.native.run('create table tasks (id text primary key, title text not null)');
        this.database.insert(this.table).values({ id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), title: 'z' }).run();
        this.database.insert(this.table).values({ id: Guid.parse('11112233-4455-6677-8899-aabbccddeeff'), title: 'a' }).run();
    }
    close() { this.native.close(); }
}
