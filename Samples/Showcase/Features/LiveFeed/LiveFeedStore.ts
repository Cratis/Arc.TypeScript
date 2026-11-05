// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject } from 'rxjs';
import type { LiveFeedMessage } from './Viewing/Viewing.js';

/** Demonstration-only in-memory feed shared by the posting and viewing slices. */
export class LiveFeedStore {
    readonly #messages: LiveFeedMessage[] = [];
    readonly #changes = new BehaviorSubject<LiveFeedMessage[]>([]);

    post(author: string, text: string): void {
        this.#messages.push({ id: crypto.randomUUID(), author, text, postedAt: new Date().toISOString() });
        this.#changes.next([...this.#messages]);
    }

    all(): BehaviorSubject<LiveFeedMessage[]> { return this.#changes; }
}
