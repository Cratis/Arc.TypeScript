// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryPagingRequired, queryPage } from '@cratis/arc.core';
import type { ExecutionContext, QueryOptions, QueryPage } from '@cratis/arc.core';
import type { ChangeStream, Collection, Db, Document, Filter, FindOptions, Timestamp } from 'mongodb';
import { defaultMongoNamingPolicy } from './MongoNamingPolicy.js';
import type { MongoCollectionOptions } from './MongoCollectionOptions.js';
import { MongoDocumentCodec } from './MongoDocumentCodec.js';
import { MongoObservation } from './MongoObservation.js';
import { MongoObservable } from './MongoObservable.js';
import { retryRead } from './retryRead.js';

/** Tenant-bound model collection. The underlying driver collection remains available for writes. */
export class MongoCollection<T extends object> {
    readonly #observations = new Set<MongoObservation<unknown>>();
    readonly codec: MongoDocumentCodec<T>;
    readonly #maxObservableItems: number;
    readonly #maxPageSize: number;
    constructor(readonly native: Collection<Document>, private readonly database: Db, type: new () => T,
        private readonly context: ExecutionContext, options: MongoCollectionOptions = {}) {
        this.#maxObservableItems = options.maxObservableItems ?? 1000;
        this.#maxPageSize = options.maxPageSize ?? 100;
        this.codec = new MongoDocumentCodec(type, options.ignoreConventions, options.namingPolicy ?? defaultMongoNamingPolicy);
        if (!Number.isSafeInteger(this.#maxObservableItems) || this.#maxObservableItems <= 0 || this.#maxObservableItems > 10000)
            throw new RangeError('maxObservableItems must be between 1 and 10000');
        if (!Number.isSafeInteger(this.#maxPageSize) || this.#maxPageSize <= 0 || this.#maxPageSize > 10000)
            throw new RangeError('maxPageSize must be between 1 and 10000');
    }
    /** Find models matching an application-owned filter. */
    async find(filter: Filter<Document> = {}, options?: FindOptions): Promise<T[]> {
        const documents = await retryRead(() => this.native.find(filter, { ...options, signal: this.context.signal }).toArray(), this.context.signal);
        return documents.map(document => this.codec.deserialize(document));
    }
    /** Read a model by its declared key. */
    async findById(id: unknown): Promise<T | null> {
        const document = await retryRead(() => this.native.findOne({ _id: this.codec.id(id) } as Filter<Document>,
            { signal: this.context.signal }), this.context.signal);
        return document ? this.codec.deserialize(document) : null;
    }
    /** Count and page in MongoDB, using only fields declared in the model for client sorting. */
    async queryPage(filter: Filter<Document>, options: QueryOptions,
        findOptions?: Omit<FindOptions, 'sort' | 'skip' | 'limit'> & { sort?: Readonly<Record<string, 1 | -1>> }): Promise<QueryPage<T>> {
        const { page, pageSize } = options.paging ?? { page: 0, pageSize: this.#maxPageSize };
        if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(pageSize) || pageSize <= 0 ||
            !Number.isSafeInteger(page * pageSize)) throw new RangeError('Invalid MongoDB page');
        if (pageSize > this.#maxPageSize) throw new QueryPagingRequired(this.#maxPageSize);
        const sorting = options.sorting;
        if (sorting && sorting.direction !== 'asc' && sorting.direction !== 'desc')
            throw new TypeError('MongoDB sorting direction must be asc or desc');
        const field = sorting ? this.codec.fieldName(sorting.field) : undefined;
        const sort = field && sorting ? { [field]: sorting.direction === 'asc' ? 1 as const : -1 as const,
            ...Object.fromEntries(Object.entries(findOptions?.sort ?? {}).filter(([name]) => name !== field)),
            ...(field === '_id' ? {} : { _id: 1 as const }) } :
            { ...findOptions?.sort, ...(!findOptions?.sort || !Object.hasOwn(findOptions.sort, '_id') ? { _id: 1 as const } : {}) };
        const total = await retryRead(() => this.native.countDocuments(filter, { collation: findOptions?.collation,
            session: findOptions?.session, signal: this.context.signal } as Parameters<typeof this.native.countDocuments>[1]),
        this.context.signal);
        if (!options.paging && total > this.#maxPageSize) throw new QueryPagingRequired(this.#maxPageSize, true);
        const documents = await retryRead(() => this.native.find(filter, { ...findOptions, sort, signal: this.context.signal })
            .skip(page * pageSize).limit(pageSize).toArray(), this.context.signal);
        return queryPage(documents.map(document => this.codec.deserialize(document)), total, sorting);
    }
    /** Read a bounded snapshot for joined observation. */
    async readForObservation(filter: Filter<Document> = {}): Promise<T[]> {
        if (this.context.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const documents = await retryRead(() => this.native.find(filter, { signal: this.context.signal })
            .limit(this.#maxObservableItems + 1).toArray(), this.context.signal);
        if (documents.length > this.#maxObservableItems) throw new RangeError('MongoDB observation exceeds maxObservableItems');
        return documents.map(document => this.codec.deserialize(document));
    }
    private async openObservation<V>(read: () => Promise<V>, pipeline: Document[]): Promise<MongoObservation<V>> {
        const hello = await this.database.command({ hello: 1 }, { signal: this.context.signal });
        if (typeof hello.setName !== 'string' && hello.msg !== 'isdbgrid')
            throw new Error('MongoDB observe requires a replica set with change streams');
        const operationTime = (hello.operationTime ?? hello.$clusterTime?.clusterTime) as Timestamp | undefined;
        if (!operationTime) throw new Error('MongoDB observe requires an operation time from the server');
        const stream: ChangeStream<Document> = this.native.watch(pipeline, { startAtOperationTime: operationTime });
        try {
            const initial = await read();
            const observation = new MongoObservation(stream, read, initial, this.context.signal,
                () => { this.#observations.delete(observation as MongoObservation<unknown>); });
            if (this.context.signal.aborted) { await observation.close(); throw new DOMException('Aborted', 'AbortError'); }
            this.#observations.add(observation as MongoObservation<unknown>);
            return observation;
        } catch (error) { await stream.close(); throw error; }
    }
    /** Observe full snapshots as an RxJS observable. Each instance owns one change stream. */
    observe(filter: Filter<Document> = {}): MongoObservable<T[]> {
        return new MongoObservable(() => this.observeIterable(filter));
    }
    /** Observe one keyed document as an RxJS observable, including deletion as `null`. */
    observeById(id: unknown): MongoObservable<T | null> {
        return new MongoObservable(() => this.observeByIdIterable(id));
    }
    /** Open an async-iterable observation for consumers that do not use RxJS. */
    observeIterable(filter: Filter<Document> = {}): Promise<MongoObservation<T[]>> {
        return this.openObservation(() => this.readForObservation(filter), []);
    }
    /** Open an async-iterable keyed observation for consumers that do not use RxJS. */
    observeByIdIterable(id: unknown): Promise<MongoObservation<T | null>> {
        const filter = { _id: this.codec.id(id) } as Filter<Document>;
        const read = () => retryRead(() => this.native.findOne(filter, { signal: this.context.signal }), this.context.signal)
            .then(document => document ? this.codec.deserialize(document) : null);
        return this.openObservation(read, [{ $match: { 'documentKey._id': filter._id } }]);
    }
    /** Refuse to join a collection from a different tenant or execution scope. */
    belongsTo(databaseName: string, context: ExecutionContext): boolean {
        return this.database.databaseName === databaseName && this.context === context;
    }
    /** End all observations with the owning Arc execution scope. */
    async [Symbol.asyncDispose](): Promise<void> {
        await Promise.all([...this.#observations].map(observation => observation.close()));
    }
}
