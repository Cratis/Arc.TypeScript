// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { asc, desc, getTableColumns, sql } from 'drizzle-orm';
import type { SQL, Table } from 'drizzle-orm';
import { InvalidQuerySort, queryPage } from '@cratis/arc.core';
import type { QueryOptions, QueryPage } from '@cratis/arc.core';
import type { DrizzleDatabase, DrizzleFilter, DrizzleOptions } from './DrizzleOptions.js';

/** Read-only, tenant-bound SQL access. No writer or native connection is reachable through this handle. */
export class DrizzleReadModels<T extends object> {
    constructor(private readonly database: DrizzleDatabase, private readonly dialect: DrizzleOptions['dialect'],
        readonly table: Table, private readonly type: new () => T, private readonly maxPageSize = 100) {
        if (!Number.isSafeInteger(maxPageSize) || maxPageSize <= 0 || maxPageSize > 10000)
            throw new RangeError('maxPageSize must be between 1 and 10000');
        if (!Object.values(getTableColumns(table)).some(column => column.primary))
            throw new Error('A Drizzle read model requires a primary key for stable paging');
    }

    private async rows(statement: SQL): Promise<Record<string, unknown>[]> {
        if (this.dialect === 'sqlite') {
            const database = this.database as { all(query: SQL): Promise<Record<string, unknown>[]> | Record<string, unknown>[] };
            return database.all(statement);
        }
        if (this.dialect === 'postgresql') {
            const database = this.database as { execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }> };
            return (await database.execute(statement)).rows;
        }
        const database = this.database as { execute(query: SQL): Promise<[Record<string, unknown>[], unknown]> };
        return (await database.execute(statement))[0];
    }

    /** Push a typed predicate, count, sort and page into SQL; never load the unbounded result before paging. */
    async queryPage(filter: DrizzleFilter, options: QueryOptions): Promise<QueryPage<T>> {
        if (!options.paging) throw new Error('Drizzle queryPage requires options.paging');
        const { page, pageSize } = options.paging;
        if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 ||
            pageSize > this.maxPageSize || !Number.isSafeInteger(page * pageSize)) throw new RangeError('Invalid Drizzle page');
        const columns = getTableColumns(this.table);
        const sorting = options.sorting;
        if (sorting && (sorting.direction !== 'asc' && sorting.direction !== 'desc' || !Object.hasOwn(columns, sorting.field)))
            throw new InvalidQuerySort(`Unknown Drizzle model field: ${sorting.field}`);
        const entries = Object.entries(columns);
        const selection = sql.join(entries.map(([name, column]) => sql`${column} as ${sql.identifier(name)}`), sql`, `);
        const where = filter ? sql` where ${filter}` : sql``;
        const count = await this.rows(sql`select count(*) as total from ${this.table}${where}`);
        const total = Number(count[0]?.total);
        if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid Drizzle count');
        const keys = entries.filter(([, column]) => column.primary).map(([, column]) => column);
        const sortColumn = sorting ? columns[sorting.field]! : keys[0]!;
        const order = sorting && sorting.direction === 'desc' ? desc(sortColumn) : asc(sortColumn);
        const tie = sql.join(keys.filter(key => key !== sortColumn).map(key => sql`, ${asc(key)}`), sql``);
        const result = await this.rows(sql`select ${selection} from ${this.table}${where} order by ${order}${tie} limit ${pageSize} offset ${page * pageSize}`);
        const items = result.map(row => {
            const model = new this.type();
            for (const [name, column] of entries) {
                const value = row[name];
                Reflect.set(model, name, value == null ? value : column.mapFromDriverValue(value));
            }
            return model;
        });
        return queryPage(items, total, sorting);
    }
}
