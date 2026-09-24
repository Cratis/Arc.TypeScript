// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CurrentValue, ObservableObserver, Subscribable } from './ObservableSource.js';

/** A current-value source for HTTP snapshots and live query subscriptions. */
export class CurrentValueSubject<T> implements Subscribable<T> {
    readonly #observers = new Set<ObservableObserver<T>>();
    #value: CurrentValue<T> = { hasValue: false };
    #closed = false;

    constructor(initial?: CurrentValue<T>) {
        if (initial) this.#value = initial;
    }

    /** An explicit presence marker distinguishes pending from a present undefined. */
    current(): CurrentValue<T> { return this.#value; }

    /** Publish the next full snapshot to active observers. */
    next(value: T): void {
        if (this.#closed) throw new Error('Subject is completed');
        this.#value = { hasValue: true, value };
        for (const observer of this.#observers) observer.next(value);
    }

    /** End the stream without inventing a final value. */
    complete(): void {
        if (this.#closed) return;
        this.#closed = true;
        for (const observer of this.#observers) observer.complete();
        this.#observers.clear();
    }

    /** Terminate with an error; subscribers receive the original error. */
    error(error: unknown): void {
        if (this.#closed) return;
        this.#closed = true;
        for (const observer of this.#observers) observer.error(error);
        this.#observers.clear();
    }

    /** Subscribe with a current-value replay, matching a behavior subject. */
    subscribe(observer: ObservableObserver<T>): { unsubscribe(): void } {
        if (this.#closed) {
            observer.complete();
            return { unsubscribe() {} };
        }
        this.#observers.add(observer);
        if (this.#value.hasValue) observer.next(this.#value.value);
        return { unsubscribe: () => { this.#observers.delete(observer); } };
    }
}
