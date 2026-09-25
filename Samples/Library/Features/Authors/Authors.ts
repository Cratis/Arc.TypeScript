// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject, Observable } from 'rxjs';
import type { Subscription } from 'rxjs';
import type { ChronicleReadModels } from '@cratis/arc.chronicle';
import type { MongoCollection } from '@cratis/arc.mongodb';
import { AuthorId } from './AuthorId.js';
import { AuthorName } from './AuthorName.js';
import type { Author } from './Listing/Listing.js';

/** One application service: in memory by default, MongoDB when configured. */
export class Authors {
    readonly #items = new Map<string, Author>();
    readonly #changes = new BehaviorSubject<Author[]>([]);
    constructor(private readonly collection?: MongoCollection<Author>,
        private readonly chronicle?: ChronicleReadModels, private readonly model?: new () => Author) {}

    async register(id: AuthorId, name: AuthorName, event?: object): Promise<void> {
        if (this.chronicle) {
            if (!event) throw new Error('Chronicle registration requires an event');
            const result = await (await this.chronicle.getStore()).eventLog.append(id.toString(), event);
            if (!result.isSuccess) throw new Error('Chronicle author registration was rejected');
            return;
        }
        const author = { id, name } as Author;
        if (this.collection) await this.collection.native.insertOne(this.collection.codec.serialize(author));
        else {
            this.#items.set(id.toString(), author);
            this.#changes.next([...this.#items.values()]);
        }
    }
    async existsByName(name: AuthorName): Promise<boolean> {
        if (this.chronicle) return (await this.all()).some(author => author.name.value === name.value);
        if (this.collection) return (await this.collection.find()).some(author => author.name.value === name.value);
        return [...this.#items.values()].some(author => author.name.value === name.value);
    }
    async observeAll(): Promise<Observable<Author[]>> {
        if (!this.chronicle) return this.collection ? this.collection.observe() : this.#changes;
        const models = this.chronicle;
        const type = this.model!;
        return new Observable<Author[]>(subscriber => {
            let stopped = false;
            let observation: Subscription | undefined;
            void (async () => {
                const current = new Map((await (await models.getStore()).readModels.getInstances(type))
                    .map(author => [author.id.toString(), author]));
                if (stopped) return;
                subscriber.next([...current.values()]);
                observation = models.watch(type).subscribe({
                    next: change => {
                        if (change.removed) current.delete(change.key);
                        else current.set(change.key, change.readModel);
                        subscriber.next([...current.values()]);
                    },
                    error: error => subscriber.error(error)
                });
            })().catch(error => subscriber.error(error));
            return () => { stopped = true; observation?.unsubscribe(); };
        });
    }
    async all(): Promise<Author[]> {
        if (this.chronicle) return (await this.chronicle.getStore()).readModels.getInstances(this.model!);
        return this.collection ? this.collection.find() : [...this.#items.values()];
    }
}
