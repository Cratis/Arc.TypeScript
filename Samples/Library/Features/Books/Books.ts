// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, type ObservableSource } from '@cratis/arc.core';
import type { MongoCollection } from '@cratis/arc.mongodb';
import type { AuthorId } from '../Authors/AuthorId.js';
import { BookId } from './BookId.js';
import { BookTitle } from './BookTitle.js';
import type { Book } from './Listing/Book.js';

export class Books {
    readonly #items = new Map<string, Book>();
    readonly #observers = new Map<string, CurrentValueSubject<Book[]>>();
    constructor(private readonly collection?: MongoCollection<Book>) {}

    async add(id: BookId, authorId: AuthorId, title: BookTitle): Promise<void> {
        const book = { id, authorId, title } as Book;
        if (this.collection) await this.collection.native.insertOne(this.collection.codec.serialize(book));
        else {
            this.#items.set(id.toString(), book);
            this.#observers.get(authorId.toString())?.next(await this.forAuthor(authorId));
        }
    }
    async forAuthor(authorId: AuthorId): Promise<Book[]> {
        const items = this.collection ? await this.collection.find() : [...this.#items.values()];
        return items.filter(book => book.authorId.toString() === authorId.toString());
    }
    async observeForAuthor(authorId: AuthorId): Promise<ObservableSource<Book[]>> {
        if (this.collection) return this.collection.observe({
            [this.collection.codec.fieldName('authorId')]: this.collection.codec.id(authorId)
        });
        const id = authorId.toString();
        let observer = this.#observers.get(id);
        if (!observer) {
            observer = CurrentValueSubject.of(await this.forAuthor(authorId));
            this.#observers.set(id, observer);
        }
        return observer;
    }
}
