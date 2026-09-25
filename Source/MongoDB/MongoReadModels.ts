// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryPagingRequired, queryPage as createQueryPage, SortDirection } from '@cratis/arc.core';
import type { ExecutionContext, PageRequest, QueryOptions, QueryPage } from '@cratis/arc.core';
import { ObjectId } from 'mongodb';
import type { CountDocumentsOptions, Document, Filter, FindOptions, WithId } from 'mongodb';
import type { MongoPage } from './MongoPage.js';
import type { MongoReadModelsOptions } from './MongoReadModelsOptions.js';
import type { MongoPageFindOptions } from './MongoPageFindOptions.js';

/** Read-only access to an application-owned collection in an explicitly resolved tenant database. */
export class MongoReadModels<T extends Document, I> {
    private readonly maxPageSize: number;
    constructor(private readonly options: MongoReadModelsOptions<T, I>, private readonly collectionName: string) {
        this.maxPageSize = options.maxPageSize ?? 100;
        if (!collectionName) throw new Error('A collection name is required');
        if (options.maxPageSize !== undefined && (!Number.isSafeInteger(options.maxPageSize) || options.maxPageSize <= 0))
            throw new RangeError('maxPageSize must be a positive safe integer');
    }

    private collection(context: ExecutionContext) {
        if (!context.tenantId) throw new Error('A tenant is required for MongoDB read-model access');
        const database = this.options.databaseForTenant(context.tenantId, context);
        if (!database) throw new Error('The tenant database resolver returned no database');
        return this.options.client.db(database).collection<T>(this.collectionName);
    }

    /** Always derive the filter through the application's typed callback. */
    async find(context: ExecutionContext, input: I, options?: FindOptions<T>): Promise<WithId<T>[]> {
        return this.collection(context).find(this.options.filterFor(input, context), { ...options, signal: context.signal }).toArray();
    }

    /** Only primitive or BSON ObjectId identities are accepted; never interpret caller input as a filter. */
    async findById(context: ExecutionContext, input: I, id: string | number | boolean | bigint | ObjectId): Promise<WithId<T> | null> {
        if (!(id instanceof ObjectId) && !(typeof id === 'string' || typeof id === 'boolean' ||
            typeof id === 'bigint' || typeof id === 'number' && Number.isFinite(id)))
            throw new TypeError('A primitive or BSON ObjectId is required for findById');
        const collection = this.collection(context);
        const filter = this.options.filterFor(input, context);
        return collection.findOne({ $and: [filter, { _id: id }] } as Filter<T>, { signal: context.signal });
    }

    /** Read a bounded first page when Arc has no paging; never silently ignore sorting. */
    async queryPage(context: ExecutionContext, input: I, options: QueryOptions,
        findOptions?: MongoPageFindOptions<T>): Promise<QueryPage<WithId<T>>> {
        const sorting = options.sorting;
        if (sorting && sorting.direction !== SortDirection.Ascending && sorting.direction !== SortDirection.Descending)
            throw new TypeError('MongoDB sorting direction must be asc or desc');
        if (sorting && !this.options.sortableFields?.includes(sorting.field))
            throw new Error(`MongoDB sorting is not allowed for field: ${sorting.field}`);
        const sort = sorting ? { [sorting.field]: sorting.direction === SortDirection.Ascending ? 1 as const : -1 as const,
            ...Object.fromEntries(Object.entries(findOptions?.sort ?? {})
                .filter(([field]) => field !== sorting.field)) } : findOptions?.sort;
        const page = await this.readPage(context, input, options.paging ?? { page: 0, pageSize: this.maxPageSize },
            { ...findOptions, sort }, !options.paging);
        return createQueryPage(page.items, page.paging.totalItems, sorting);
    }

    async page(context: ExecutionContext, input: I, request: PageRequest, options?: MongoPageFindOptions<T>): Promise<MongoPage<T>> {
        return this.readPage(context, input, request, options, false);
    }

    private async readPage(context: ExecutionContext, input: I, request: PageRequest, options: MongoPageFindOptions<T> | undefined,
        rejectUnpaged: boolean): Promise<MongoPage<T>> {
        if (!Number.isSafeInteger(request.page) || request.page < 0 ||
            !Number.isSafeInteger(request.pageSize) || request.pageSize <= 0 ||
            !Number.isSafeInteger(request.page * request.pageSize))
            throw new RangeError('Paging requires a nonnegative page and positive pageSize within safe integer bounds');
        if (request.pageSize > this.maxPageSize) throw new QueryPagingRequired(this.maxPageSize);
        const sort = options?.sort;
        if (sort !== undefined && (typeof sort !== 'object' || sort === null || Array.isArray(sort) ||
            Object.getPrototypeOf(sort) !== Object.prototype && Object.getPrototypeOf(sort) !== null ||
            Object.entries(sort).some(([field, direction]) => !field || direction !== 1 && direction !== -1)))
            throw new TypeError('Paged MongoDB sort requires an object of field names and 1 or -1 directions');
        const orderedSort = { ...sort, ...(!sort || !Object.hasOwn(sort, '_id') ? { _id: 1 as const } : {}) };
        const collection = this.collection(context);
        const filter = this.options.filterFor(input, context);
        const { collation, hint, session, readPreference, readConcern, maxTimeMS, comment } = options ?? {};
        // Driver 6.21 accepts signal in the aggregation cursor used by countDocuments, but omits it from CountDocumentsOptions.
        const countOptions: CountDocumentsOptions & { signal: AbortSignal } = {
            collation, hint, session, readPreference, readConcern, maxTimeMS, comment, signal: context.signal
        };
        const totalItems = await collection.countDocuments(filter, countOptions);
        if (rejectUnpaged && totalItems > this.maxPageSize) throw new QueryPagingRequired(this.maxPageSize, true);
        const items = await collection.find(filter, { ...options, sort: orderedSort, signal: context.signal })
            .skip(request.page * request.pageSize).limit(request.pageSize).toArray();
        return { items, paging: { page: request.page, size: request.pageSize,
            totalItems, totalPages: Math.ceil(totalItems / request.pageSize) } };
    }
}
