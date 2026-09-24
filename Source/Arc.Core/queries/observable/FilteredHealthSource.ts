// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ObservableObserver } from './ObservableObserver.js';
import type { QueryHealthSnapshot } from './QueryHealthSnapshot.js';
import type { CurrentValueSubject } from './CurrentValueSubject.js';

/** Emits only changes visible to one caller, coalescing bursts into a bounded cadence. */
export class FilteredHealthSource {
    constructor(readonly changes: CurrentValueSubject<number>, readonly snapshot: () => QueryHealthSnapshot) {}

    current(): { hasValue: true; value: QueryHealthSnapshot } {
        return { hasValue: true, value: this.snapshot() };
    }

    subscribe(observer: ObservableObserver<QueryHealthSnapshot>): { unsubscribe(): void } {
        let closed = false;
        let lastSerialized: string | undefined;
        let lastSentAt = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const send = (): void => {
            if (closed) return;
            const value = this.snapshot();
            const serialized = JSON.stringify(value);
            if (serialized === lastSerialized) return;
            const remaining = lastSentAt + 50 - Date.now();
            if (lastSerialized !== undefined && remaining > 0) {
                if (!timer) timer = setTimeout(() => { timer = undefined; send(); }, remaining);
                return;
            }
            lastSerialized = serialized;
            lastSentAt = Date.now();
            observer.next(value);
        };
        const subscription = this.changes.subscribe({ next: send,
            error: error => observer.error(error), complete: () => observer.complete() });
        return { unsubscribe() {
            if (closed) return;
            closed = true;
            if (timer) clearTimeout(timer);
            subscription.unsubscribe();
        } };
    }
}
