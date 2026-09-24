// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Registry-owned lifetime, never a request's identity or cancellation signal. */
export interface SingletonServiceContext {
    readonly signal: AbortSignal;
}
