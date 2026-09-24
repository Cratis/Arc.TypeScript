// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** An RxJS-compatible observer; subscriptions own their disposal. */
export interface ObservableObserver<T> {
    next(value: T): void;
    error(error: unknown): void;
    complete(): void;
}

/** A structural subscription; RxJS is not required by the server. */
export interface Subscribable<T> {
    subscribe(observer: ObservableObserver<T>): { unsubscribe(): void } | (() => void);
}

/** Current value is explicit: undefined may itself be a present value. */
export type CurrentValue<T> = { readonly hasValue: false } | { readonly hasValue: true; readonly value: T };

/** An observable producer may expose its current value for ordinary HTTP GET. */
export type ObservableSource<T> = (AsyncIterable<T> | Subscribable<T>) & { current?(): CurrentValue<T> };
