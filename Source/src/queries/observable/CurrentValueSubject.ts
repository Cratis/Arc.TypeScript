// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CurrentValue } from './CurrentValue.js';
import type { ObservableObserver } from './ObservableObserver.js';
import type { Subscribable } from './Subscribable.js';

/** A current-value source for HTTP snapshots and live query subscriptions. */
export class CurrentValueSubject<T> implements Subscribable<T> {
    readonly #observers = new Set<ObservableObserver<T>>();
    #value: CurrentValue<T> = { hasValue: false };
    #closed = false;
    #failure: unknown;
    #hasFailure = false;

    constructor(initial?: T | CurrentValue<T>) {
        if (!arguments.length) return;
        if (initial !== null && typeof initial === 'object' && 'hasValue' in initial &&
            typeof initial.hasValue === 'boolean' && (!initial.hasValue || 'value' in initial))
            this.#value = initial as CurrentValue<T>;
        else this.#value = { hasValue: true, value: initial as T };
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
        this.#failure = error;
        this.#hasFailure = true;
        for (const observer of this.#observers) observer.error(error);
        this.#observers.clear();
    }

    /** Subscribe with a current-value replay, matching a behavior subject. */
    subscribe(observer: ObservableObserver<T>): { unsubscribe(): void } {
        if (this.#closed) {
            if (this.#hasFailure) observer.error(this.#failure);
            else observer.complete();
            return { unsubscribe() {} };
        }
        this.#observers.add(observer);
        if (this.#value.hasValue) observer.next(this.#value.value);
        return { unsubscribe: () => { this.#observers.delete(observer); } };
    }
}
