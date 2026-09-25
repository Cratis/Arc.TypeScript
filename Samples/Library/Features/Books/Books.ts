// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject, Observable } from 'rxjs';
import type { Subscription } from 'rxjs';
import type { ChronicleReadModels } from '@cratis/arc.chronicle';
import type { MongoCollection } from '@cratis/arc.mongodb';
import type { AuthorId } from '../Authors/AuthorId.js';
import { BookId } from './BookId.js';
import { BookTitle } from './BookTitle.js';
import type { Book } from './Listing/Listing.js';

export class Books {
    readonly #items = new Map<string, Book>();
    readonly #observers = new Map<string, BehaviorSubject<Book[]>>();
    constructor(private readonly collection?: MongoCollection<Book>,
        private readonly chronicle?: ChronicleReadModels, private readonly model?: new () => Book) {}

    async add(id: BookId, authorId: AuthorId, title: BookTitle, event?: object): Promise<void> {
        if (this.chronicle) {
            if (!event) throw new Error('Chronicle book registration requires an event');
            const result = await (await this.chronicle.getStore()).eventLog.append(id.toString(), event);
            if (!result.isSuccess) throw new Error('Chronicle book registration was rejected');
            return;
        }
        const book = { id, authorId, title } as Book;
        if (this.collection) await this.collection.native.insertOne(this.collection.codec.serialize(book));
        else {
            this.#items.set(id.toString(), book);
            this.#observers.get(authorId.toString())?.next(await this.forAuthor(authorId));
        }
    }
    async forAuthor(authorId: AuthorId): Promise<Book[]> {
        const items = this.chronicle ? await (await this.chronicle.getStore()).readModels.getInstances(this.model!) :
            this.collection ? await this.collection.find() : [...this.#items.values()];
        return items.filter(book => book.authorId.toString() === authorId.toString());
    }
    async observeForAuthor(authorId: AuthorId): Promise<Observable<Book[]>> {
        if (this.chronicle) {
            const models = this.chronicle;
            const type = this.model!;
            return new Observable<Book[]>(subscriber => {
                let stopped = false;
                let observation: Subscription | undefined;
                void (async () => {
                    const current = new Map((await (await models.getStore()).readModels.getInstances(type))
                        .map(book => [book.id.toString(), book]));
                    if (stopped) return;
                    const emit = () => subscriber.next([...current.values()].filter(book =>
                        book.authorId.toString() === authorId.toString()));
                    emit();
                    observation = models.watch(type).subscribe({
                        next: change => {
                            if (change.removed) current.delete(change.key);
                            else current.set(change.key, change.readModel);
                            emit();
                        },
                        error: error => subscriber.error(error)
                    });
                })().catch(error => subscriber.error(error));
                return () => { stopped = true; observation?.unsubscribe(); };
            });
        }
        if (this.collection) return this.collection.observe({
            [this.collection.codec.fieldName('authorId')]: this.collection.codec.id(authorId)
        });
        const id = authorId.toString();
        let observer = this.#observers.get(id);
        if (!observer) {
            observer = new BehaviorSubject(await this.forAuthor(authorId));
            this.#observers.set(id, observer);
        }
        return observer;
    }
}
