// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { asc, desc, eq, getTableColumns } from 'drizzle-orm';
import type { Column, SQL, Table } from 'drizzle-orm';
import { InvalidQuerySort, QueryPagingRequired, queryPage } from '@cratis/arc.core';
import type { QueryOptions, QueryPage } from '@cratis/arc.core';
import type { DrizzleDatabase } from './DrizzleDatabase.js';
import type { DrizzleFilter } from './DrizzleFilter.js';
import { DrizzleModelCodec } from './DrizzleModelCodec.js';

// Each Drizzle driver implements these query-builder operations and maps selected columns on execute.
type SelectQuery = {
    where(filter: DrizzleFilter): SelectQuery;
    orderBy(...columns: SQL[]): SelectQuery;
    limit(size: number): SelectQuery;
    offset(index: number): SelectQuery;
    execute(): Promise<Record<string, unknown>[]> | Record<string, unknown>[];
};
type ReadDatabase = {
    select(fields: Record<string, Column>): { from(table: Table): SelectQuery };
    $count(table: Table, filter: DrizzleFilter): PromiseLike<number> | number;
};

/** Tenant-bound read API; this handle exposes no writer, but does not enforce database permissions. */
export class DrizzleReadModels<T extends object> {
    private readonly codec: DrizzleModelCodec<T>;
    private readonly keys: Column[];
    private readonly columns: Record<string, Column>;
    constructor(private readonly database: DrizzleDatabase, readonly table: Table, type: new () => T,
        private readonly maxPageSize = 100, codec?: DrizzleModelCodec<T>) {
        if (!Number.isSafeInteger(maxPageSize) || maxPageSize <= 0 || maxPageSize > 10000)
            throw new RangeError('maxPageSize must be between 1 and 10000');
        this.columns = getTableColumns(table);
        this.keys = Object.values(this.columns).filter(column => column.primary);
        if (!this.keys.length) throw new Error('A Drizzle read model requires a primary key for stable paging');
        this.codec = codec ?? new DrizzleModelCodec(type, this.columns);
    }

    private get db(): ReadDatabase { return this.database as ReadDatabase; }

    private order(sorting?: QueryOptions['sorting']): SQL[] {
        if (sorting && (sorting.direction !== 'asc' && sorting.direction !== 'desc' ||
            !this.codec.sortableFields.has(sorting.field)))
            throw new InvalidQuerySort(`Unknown Drizzle model field: ${sorting.field}`);
        const sortColumn = sorting ? this.columns[sorting.field]! : this.keys[0]!;
        return [sorting?.direction === 'desc' ? desc(sortColumn) : asc(sortColumn),
            ...this.keys.filter(key => key !== sortColumn).map(key => asc(key))];
    }

    private async select(filter: DrizzleFilter, sorting: QueryOptions['sorting'], limit: number, offset = 0): Promise<T[]> {
        const order = this.order(sorting);
        const rows = await this.db.select(this.codec.selection).from(this.table).where(filter)
            .orderBy(...order).limit(limit).offset(offset).execute();
        return rows.map(row => this.codec.deserialize(row));
    }

    /** Return at most maxPageSize matches, never an unbounded result. */
    async find(filter: DrizzleFilter, sorting?: QueryOptions['sorting']): Promise<T[]> {
        this.order(sorting);
        const total = await this.db.$count(this.table, filter);
        if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid Drizzle count');
        if (total > this.maxPageSize) throw new QueryPagingRequired(this.maxPageSize, true);
        return this.select(filter, sorting, this.maxPageSize);
    }

    /** Return the first match in stable primary-key order. */
    async findOne(filter: DrizzleFilter): Promise<T | undefined> {
        return (await this.select(filter, undefined, 1))[0];
    }

    /** Find by the single declared primary key, binding a typed key for custom columns and a primitive for plain columns. */
    async findById(key: string): Promise<T | null> {
        if (this.keys.length !== 1) throw new Error('Drizzle command read models require a single primary key');
        const column = this.keys[0]!;
        const name = Object.entries(this.columns).find(([, candidate]) => candidate === column)![0];
        return await this.findOne(eq(column, this.codec.keyValue(name, key))) ?? null;
    }

    /** Push a typed predicate, count, sort and page into SQL; never load the unbounded result before paging. */
    async queryPage(filter: DrizzleFilter, options: QueryOptions): Promise<QueryPage<T>> {
        const { page, pageSize } = options.paging ?? { page: 0, pageSize: this.maxPageSize };
        if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1 ||
            !Number.isSafeInteger(page * pageSize)) throw new RangeError('Invalid Drizzle page');
        if (pageSize > this.maxPageSize) throw new QueryPagingRequired(this.maxPageSize);
        this.order(options.sorting);
        const total = await this.db.$count(this.table, filter);
        if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid Drizzle count');
        if (!options.paging && total > this.maxPageSize) throw new QueryPagingRequired(this.maxPageSize, true);
        const items = await this.select(filter, options.sorting, pageSize, page * pageSize);
        return queryPage(items, total, options.sorting);
    }
}
