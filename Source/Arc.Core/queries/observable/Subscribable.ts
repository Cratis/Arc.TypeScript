// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ObservableObserver } from './ObservableObserver.js';

/** A structural subscription; RxJS is not required by the server. */
export interface Subscribable<T> {
    subscribe(observer: ObservableObserver<T>): { unsubscribe(): void } | (() => void);
}
