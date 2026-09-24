// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** An RxJS-compatible observer; subscriptions own their disposal. */
export interface ObservableObserver<T> {
    next(value: T): void;
    error(error: unknown): void;
    complete(): void;
}
