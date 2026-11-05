// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject } from 'rxjs';
import { Guid } from '@cratis/fundamentals';
import type { ObservableCollectionWithGuidItem } from './Listing/Listing.js';

/** Demonstration-only in-memory collection shared by the adding, removing and listing slices. */
export class ObservableCollectionWithGuidStore {
    readonly #items = new Map<string, ObservableCollectionWithGuidItem>();
    readonly #changes = new BehaviorSubject<ObservableCollectionWithGuidItem[]>([]);


    add(name: string): ObservableCollectionWithGuidItem {
        const item: ObservableCollectionWithGuidItem = { id: Guid.create(), name };
        this.#items.set(String(item.id), item);
        this.#changes.next([...this.#items.values()]);
        return item;
    }

    remove(id: Guid): void {
        this.#items.delete(String(id));
        this.#changes.next([...this.#items.values()]);
    }

    all(): BehaviorSubject<ObservableCollectionWithGuidItem[]> { return this.#changes; }
}
