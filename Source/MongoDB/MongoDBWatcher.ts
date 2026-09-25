// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '@cratis/arc.core';
import { Observable } from 'rxjs';
import type { ChangeStream, ChangeStreamDocument, Db, Document, Filter, Timestamp } from 'mongodb';
import type { MongoCollection } from './MongoCollection.js';

function collectionName(change: ChangeStreamDocument<Document>): string | undefined {
    return 'ns' in change && change.ns && 'coll' in change.ns ? change.ns.coll : undefined;
}

/** Tenant- and scope-bound database watcher. Its subscribers share one database change stream. */
export class MongoDBWatcher {
    readonly #listeners = new Set<{ change: (change: ChangeStreamDocument<Document>) => void; error: (error: unknown) => void }>();
    #stream?: ChangeStream<Document>;
    #opening?: Promise<void>;
    #disposed = false;
    #generation = 0;
    readonly #abort = () => { void this[Symbol.asyncDispose](); };

    constructor(private readonly database: Db, private readonly context: ExecutionContext) {
        context.signal.addEventListener('abort', this.#abort, { once: true });
        if (context.signal.aborted) this.#abort();
    }

    /** Start a typed observation. Join another collection before selecting the result. */
    observe<T extends object>(collection: MongoCollection<T>, filter: Filter<Document> = {}): MongoDBObserveBuilder<T> {
        this.assertCollection(collection);
        return new MongoDBObserveBuilder(this, collection, filter);
    }

    /** React to raw changes on one collection, including deletes (which have no full document). */
    changes<T extends object>(collection: MongoCollection<T>): Observable<ChangeStreamDocument<Document>> {
        this.assertCollection(collection);
        return new Observable(subscriber => {
            void this.listen(change => {
                if (collectionName(change) === collection.native.collectionName) subscriber.next(change);
            }, error => subscriber.error(error)).then(release => {
                if (subscriber.closed) release();
                else subscriber.add(release);
            }).catch(error => subscriber.error(error));
        });
    }

    /** Build a complete joined snapshot; notifications are coalesced, never buffered without a bound. */
    select<R>(collections: readonly MongoCollection<object>[], filters: readonly Filter<Document>[],
        selector: (...documents: object[][]) => R): Observable<R> {
        collections.forEach(collection => this.assertCollection(collection));
        const names = new Set(collections.map(collection => collection.native.collectionName));
        return new Observable(subscriber => {
            let dirty = false;
            let running = false;
            let release: (() => void) | undefined;
            const read = async () => {
                if (running || subscriber.closed) return;
                running = true;
                try {
                    do {
                        dirty = false;
                        const values = await Promise.all(collections.map((collection, index) =>
                            collection.readForObservation(filters[index])));
                        if (!subscriber.closed && !this.#disposed) subscriber.next(selector(...values));
                    } while (dirty && !subscriber.closed && !this.#disposed);
                } catch (error) { if (!subscriber.closed) subscriber.error(error); }
                finally { running = false; }
            };
            void this.listen(change => {
                if (names.has(collectionName(change) ?? '')) { dirty = true; void read(); }
            }, error => subscriber.error(error)).then(stop => {
                release = stop;
                if (subscriber.closed) stop();
                else void read();
            }).catch(error => { if (!subscriber.closed) subscriber.error(error); });
            return () => { release?.(); };
        });
    }

    private assertCollection(collection: MongoCollection<object>): void {
        if (this.#disposed || !collection.belongsTo(this.database.databaseName, this.context))
            throw new Error('MongoDB watcher requires a collection from the same tenant and scope');
    }

    private async listen(change: (event: ChangeStreamDocument<Document>) => void, error: (error: unknown) => void): Promise<() => void> {
        if (this.#disposed) throw new Error('MongoDB watcher is disposed');
        const listener = { change, error };
        this.#listeners.add(listener);
        try { await (this.#opening ??= this.start()); }
        catch (failure) { this.#listeners.delete(listener); throw failure; }
        if (this.#disposed) { this.#listeners.delete(listener); throw new Error('MongoDB watcher is disposed'); }
        return () => {
            this.#listeners.delete(listener);
            if (!this.#listeners.size) void this.stop();
        };
    }

    private async start(generation = this.#generation): Promise<void> {
        try {
            const hello = await this.database.command({ hello: 1 }, { signal: this.context.signal });
            if (typeof hello.setName !== 'string' && hello.msg !== 'isdbgrid')
                throw new Error('MongoDB observe requires a replica set with change streams');
            const operationTime = (hello.operationTime ?? hello.$clusterTime?.clusterTime) as Timestamp | undefined;
            if (!operationTime) throw new Error('MongoDB observe requires an operation time from the server');
            if (this.#disposed || generation !== this.#generation) return;
            if (!this.#listeners.size) { this.#opening = undefined; return; }
            const stream = this.database.watch<Document>([], { startAtOperationTime: operationTime, fullDocument: 'updateLookup' });
            this.#stream = stream;
            void this.pump(stream);
        } catch (error) {
            if (generation === this.#generation) this.#opening = undefined;
            throw error;
        }
    }

    private async pump(stream: ChangeStream<Document>): Promise<void> {
        try {
            while (this.#stream === stream && !this.#disposed) {
                const event = await stream.next();
                if (!event) throw new Error('MongoDB change stream ended');
                if (this.#stream !== stream || this.#disposed) break;
                for (const listener of [...this.#listeners]) listener.change(event);
            }
        } catch (error) {
            if (this.#stream === stream && !this.#disposed) {
                const listeners = [...this.#listeners];
                this.#listeners.clear();
                try { await this.stop(); }
                finally { for (const listener of listeners) listener.error(error); }
            }
        } finally {
            if (this.#stream === stream) await this.stop();
        }
    }

    private async stop(): Promise<void> {
        this.#generation++;
        const stream = this.#stream;
        this.#stream = undefined;
        this.#opening = undefined;
        if (stream) await stream.close();
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (this.#disposed) return;
        this.#disposed = true;
        this.context.signal.removeEventListener('abort', this.#abort);
        for (const listener of [...this.#listeners]) listener.error(new DOMException('Aborted', 'AbortError'));
        this.#listeners.clear();
        await this.stop();
    }
}

/** Join two or three tenant-scoped collections and select a live result. */
export class MongoDBObserveBuilder<T extends object> {
    constructor(private readonly watcher: MongoDBWatcher, private readonly primary: MongoCollection<T>,
        private readonly filter: Filter<Document>) {}
    join<U extends object>(collection: MongoCollection<U>, filter: Filter<Document> = {}): MongoDBJoinedObserveBuilder<T, U> {
        return new MongoDBJoinedObserveBuilder(this.watcher, this.primary, this.filter, collection, filter);
    }
}

export class MongoDBJoinedObserveBuilder<T extends object, U extends object> {
    constructor(private readonly watcher: MongoDBWatcher, private readonly primary: MongoCollection<T>,
        private readonly primaryFilter: Filter<Document>, private readonly related: MongoCollection<U>,
        private readonly relatedFilter: Filter<Document>) {}
    join<V extends object>(collection: MongoCollection<V>, filter: Filter<Document> = {}): MongoDBThreeWayObserveBuilder<T, U, V> {
        return new MongoDBThreeWayObserveBuilder(this.watcher, this.primary, this.primaryFilter, this.related,
            this.relatedFilter, collection, filter);
    }
    select<R>(selector: (primary: T[], related: U[]) => R): Observable<R> {
        return this.watcher.select([this.primary, this.related], [this.primaryFilter, this.relatedFilter],
            (primary, related) => selector(primary as T[], related as U[]));
    }
}

export class MongoDBThreeWayObserveBuilder<T extends object, U extends object, V extends object> {
    constructor(private readonly watcher: MongoDBWatcher, private readonly primary: MongoCollection<T>,
        private readonly primaryFilter: Filter<Document>, private readonly related: MongoCollection<U>,
        private readonly relatedFilter: Filter<Document>, private readonly third: MongoCollection<V>,
        private readonly thirdFilter: Filter<Document>) {}
    select<R>(selector: (primary: T[], related: U[], third: V[]) => R): Observable<R> {
        return this.watcher.select([this.primary, this.related, this.third],
            [this.primaryFilter, this.relatedFilter, this.thirdFilter],
            (primary, related, third) => selector(primary as T[], related as U[], third as V[]));
    }
}
