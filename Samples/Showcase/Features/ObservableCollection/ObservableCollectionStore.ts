// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject } from 'rxjs';
import type { ObservableCollectionItem } from './Listing/Listing.js';

/** Demonstration-only in-memory collection shared by the adding, removing and listing slices. */
export class ObservableCollectionStore {
    readonly #items = new Map<string, ObservableCollectionItem>();
    readonly #changes = new BehaviorSubject<ObservableCollectionItem[]>([]);
    #next = 1;

    add(name: string): ObservableCollectionItem {
        const item: ObservableCollectionItem = { id: this.#next++, name };
        this.#items.set(String(item.id), item);
        this.#changes.next([...this.#items.values()]);
        return item;
    }

    remove(id: number): void {
        this.#items.delete(String(id));
        this.#changes.next([...this.#items.values()]);
    }

    all(): BehaviorSubject<ObservableCollectionItem[]> { return this.#changes; }
}
