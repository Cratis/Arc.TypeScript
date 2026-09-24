// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Typed overload distinct from a broken observable producer or query. */
export class ObservableSubscriptionLimitError extends Error {
    constructor() { super('Observable query subscription limit reached'); }
}
