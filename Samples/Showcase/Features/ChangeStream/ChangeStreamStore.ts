// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject } from 'rxjs';
import type { ChangeStreamItem } from './Listing/Listing.js';

/** Demonstration-only in-memory collection whose observers receive add, replace and remove change sets. */
export class ChangeStreamStore {
    readonly #items = new Map<number, ChangeStreamItem>();
    readonly #changes = new BehaviorSubject<ChangeStreamItem[]>([]);
    #next = 1;

    add(name: string, value: number): void {
        const id = this.#next++;
        this.#items.set(id, { id, name, value });
        this.publish();
    }

    update(id: number, value: number): void {
        const item = this.#items.get(id);
        if (item) this.#items.set(id, { ...item, value });
        this.publish();
    }

    remove(id: number): void {
        this.#items.delete(id);
        this.publish();
    }

    all(): BehaviorSubject<ChangeStreamItem[]> { return this.#changes; }

    private publish(): void { this.#changes.next([...this.#items.values()]); }
}
