// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Observable } from 'rxjs';
import type { CurrentValue } from './CurrentValue.js';
import type { Subscribable } from './Subscribable.js';

/** RxJS is the default; structural subscriptions and async iterables remain supported without a runtime RxJS import. */
export type ObservableSource<T> = (Observable<T> | AsyncIterable<T> | Subscribable<T>) & {
    current?(): CurrentValue<T> | Promise<CurrentValue<T>>;
};
