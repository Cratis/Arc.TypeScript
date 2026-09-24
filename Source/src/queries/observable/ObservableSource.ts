// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CurrentValue } from './CurrentValue.js';
import type { Subscribable } from './Subscribable.js';

/** An observable producer may expose its current value for ordinary HTTP GET. */
export type ObservableSource<T> = (AsyncIterable<T> | Subscribable<T>) & { current?(): CurrentValue<T> };
