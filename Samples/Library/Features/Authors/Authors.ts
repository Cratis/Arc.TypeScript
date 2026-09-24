// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, type ObservableSource } from '@cratis/arc.core';
import type { MongoCollection } from '@cratis/arc.mongodb';
import { AuthorId } from './AuthorId.js';
import { AuthorName } from './AuthorName.js';
import type { Author } from './Listing/Author.js';

/** One application service: in memory by default, MongoDB when configured. */
export class Authors {
    readonly #items = new Map<string, Author>();
    readonly #changes = CurrentValueSubject.of<Author[]>([]);
    constructor(private readonly collection?: MongoCollection<Author>) {}

    async register(id: AuthorId, name: AuthorName): Promise<void> {
        const author = { id, name } as Author;
        if (this.collection) await this.collection.native.insertOne(this.collection.codec.serialize(author));
        else {
            this.#items.set(id.toString(), author);
            this.#changes.next([...this.#items.values()]);
        }
    }
    async existsByName(name: AuthorName): Promise<boolean> {
        if (this.collection) return (await this.collection.find()).some(author => author.name.value === name.value);
        return [...this.#items.values()].some(author => author.name.value === name.value);
    }
    async observeAll(): Promise<ObservableSource<Author[]>> {
        return this.collection ? this.collection.observe() : this.#changes;
    }
    async all(): Promise<Author[]> {
        return this.collection ? this.collection.find() : [...this.#items.values()];
    }
}
