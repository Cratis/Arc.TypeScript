// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A non-cancellation transport failure that must be logged and terminate delivery. */
export class ObservableTransportError extends Error {
    constructor(message: string, options?: ErrorOptions) { super(message, options); }
}
