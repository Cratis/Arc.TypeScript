// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Suite } from 'mocha';

/** Create one context per specification group. */
export function given<T extends object>(type: new (suite: Suite) => T, callback: (this: Suite, context: T) => void) {
    return function (this: Suite) { callback.call(this, new type(this)); };
}
