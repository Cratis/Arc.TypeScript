// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CurrentValue } from './CurrentValue.js';
import type { Subscribable } from './Subscribable.js';

/** RxJS observables satisfy Subscribable; async iterables and structural subscriptions need no RxJS types. */
export type ObservableSource<T> = (AsyncIterable<T> | Subscribable<T>) & {
    current?(): CurrentValue<T> | Promise<CurrentValue<T>>;
};
