// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { queryPage } from '@cratis/arc.core';
import type { ExecutionContext, QueryOptions, QueryPage } from '@cratis/arc.core';
import type { Collection, Db, Document, Filter, FindOptions } from 'mongodb';
import { MongoDocumentCodec } from './MongoDocumentCodec.js';
import { MongoObservation } from './MongoObservation.js';

/** Tenant-bound model collection. The underlying driver collection remains available for writes. */
export class MongoCollection<T extends object> {
    readonly #observations = new Set<MongoObservation<unknown>>();
    readonly codec: MongoDocumentCodec<T>;
    constructor(readonly native: Collection<Document>, private readonly database: Db, type: new () => T, private readonly context: ExecutionContext,
        ignoreConventions = false, private readonly maxObservableItems = 1000, private readonly maxPageSize = 100) {
        this.codec = new MongoDocumentCodec(type, ignoreConventions);
        if (!Number.isSafeInteger(maxObservableItems) || maxObservableItems <= 0 || maxObservableItems > 10000)
            throw new RangeError('maxObservableItems must be between 1 and 10000');
        if (!Number.isSafeInteger(maxPageSize) || maxPageSize <= 0 || maxPageSize > 10000)
            throw new RangeError('maxPageSize must be between 1 and 10000');
    }
    /** Find models matching an application-owned filter. */
    async find(filter: Filter<Document> = {}, options?: FindOptions): Promise<T[]> {
        const documents = await this.native.find(filter, { ...options, signal: this.context.signal }).toArray();
        return documents.map(document => this.codec.deserialize(document));
    }
    /** Read a model by its declared key. */
    async findById(id: unknown): Promise<T | null> {
        const document = await this.native.findOne({ _id: this.codec.id(id) } as Filter<Document>, { signal: this.context.signal });
        return document ? this.codec.deserialize(document) : null;
    }
    /** Count and page in MongoDB, using only fields declared in the model for client sorting. */
    async queryPage(filter: Filter<Document>, options: QueryOptions, findOptions?: FindOptions): Promise<QueryPage<T>> {
        if (!options.paging) throw new Error('MongoDB queryPage requires options.paging');
        const { page, pageSize } = options.paging;
        if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(pageSize) || pageSize <= 0 ||
            pageSize > this.maxPageSize || !Number.isSafeInteger(page * pageSize)) throw new RangeError('Invalid MongoDB page');
        const sorting = options.sorting;
        if (sorting && sorting.direction !== 'asc' && sorting.direction !== 'desc')
            throw new TypeError('MongoDB sorting direction must be asc or desc');
        const field = sorting ? this.codec.fieldName(sorting.field) : undefined;
        const sort = field && sorting ? { [field]: sorting.direction === 'asc' ? 1 as const : -1 as const,
            ...(field === '_id' ? {} : { _id: 1 as const }) } : { _id: 1 as const };
        const total = await this.native.countDocuments(filter, { collation: findOptions?.collation, session: findOptions?.session,
            signal: this.context.signal } as Parameters<typeof this.native.countDocuments>[1]);
        const documents = await this.native.find(filter, { ...findOptions, sort, signal: this.context.signal })
            .skip(page * pageSize).limit(pageSize).toArray();
        return queryPage(documents.map(document => this.codec.deserialize(document)), total, sorting);
    }
    private async readObservable(filter: Filter<Document>): Promise<T[]> {
        const documents = await this.native.find(filter, { signal: this.context.signal }).limit(this.maxObservableItems + 1).toArray();
        if (documents.length > this.maxObservableItems) throw new RangeError('MongoDB observation exceeds maxObservableItems');
        return documents.map(document => this.codec.deserialize(document));
    }
    /** Open a replica-set change stream before reading the initial value; fail when change streams are unavailable. */
    async observe(filter: Filter<Document> = {}): Promise<MongoObservation<T[]>> {
        const hello = await this.database.command({ hello: 1 }, { signal: this.context.signal });
        if (typeof hello.setName !== 'string') throw new Error('MongoDB observe requires a replica set with change streams');
        const stream = this.native.watch([], { maxAwaitTimeMS: 100 });
        try {
            await stream.tryNext(); // Force the server to create the cursor before taking the snapshot.
            const initial = await this.readObservable(filter);
            const observation = new MongoObservation(stream, () => this.readObservable(filter), initial, this.context.signal,
                () => { this.#observations.delete(observation as MongoObservation<unknown>); });
            if (this.context.signal.aborted) { await observation.close(); throw new DOMException('Aborted', 'AbortError'); }
            this.#observations.add(observation as MongoObservation<unknown>);
            return observation;
        } catch (error) { await stream.close(); throw error; }
    }
    /** Observe a keyed document, including deletion as `null`. */
    async observeById(id: unknown): Promise<MongoObservation<T | null>> {
        const hello = await this.database.command({ hello: 1 }, { signal: this.context.signal });
        if (typeof hello.setName !== 'string') throw new Error('MongoDB observe requires a replica set with change streams');
        const filter = { _id: this.codec.id(id) } as Filter<Document>;
        const stream = this.native.watch([], { maxAwaitTimeMS: 100 });
        try {
            await stream.tryNext();
            const read = () => this.native.findOne(filter, { signal: this.context.signal })
                .then(document => document ? this.codec.deserialize(document) : null);
            const initial = await read();
            const observation = new MongoObservation(stream, read, initial, this.context.signal,
                () => { this.#observations.delete(observation as MongoObservation<unknown>); });
            if (this.context.signal.aborted) { await observation.close(); throw new DOMException('Aborted', 'AbortError'); }
            this.#observations.add(observation as MongoObservation<unknown>);
            return observation;
        } catch (error) { await stream.close(); throw error; }
    }
    /** End all observations with the owning Arc execution scope. */
    async [Symbol.asyncDispose](): Promise<void> {
        await Promise.all([...this.#observations].map(observation => observation.close()));
    }
}
