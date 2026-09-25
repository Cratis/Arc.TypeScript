// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Observable } from 'rxjs';
import type { MongoObservation } from './MongoObservation.js';

/** Lazy RxJS observations, with one MongoDB change stream per subscription. */
export class MongoObservable<T> extends Observable<T> {
    #pendingSnapshot?: Promise<MongoObservation<T>>;

    constructor(private readonly open: () => Promise<MongoObservation<T>>) {
        super(subscriber => {
            let observation: MongoObservation<T> | undefined;
            const opening = this.#pendingSnapshot ?? this.open();
            this.#pendingSnapshot = undefined;
            void opening.then(async result => {
                observation = result;
                if (subscriber.closed) { await result.close(); return; }
                try {
                    for await (const value of result) {
                        if (subscriber.closed) break;
                        subscriber.next(value);
                    }
                    if (!subscriber.closed) subscriber.complete();
                } catch (error) { if (!subscriber.closed) subscriber.error(error); }
            }).catch(error => { if (!subscriber.closed) subscriber.error(error); });
            return () => { if (observation) void observation.close(); };
        });
    }

    /** Read the initial snapshot before subscribing, without opening a second change stream. */
    async current(): Promise<{ hasValue: true; value: T }> {
        return (await (this.#pendingSnapshot ??= this.open())).current();
    }
}
