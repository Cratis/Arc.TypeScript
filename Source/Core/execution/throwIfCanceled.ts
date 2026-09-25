// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from './ExecutionContext.js';

/** Do not admit another operation stage once a request has been canceled. */
export function throwIfCanceled(context: ExecutionContext, message: string): void {
    if (context.signal.aborted) throw context.signal.reason ?? new Error(message);
}
