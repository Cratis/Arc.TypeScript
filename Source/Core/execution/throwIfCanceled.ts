// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from './ExecutionContext.js';
/** Never admit a new stage after cancellation, regardless of any acknowledged effects. */
export function throwIfCanceled(context: ExecutionContext, message: string): void {
    if (context.signal.aborted) throw context.signal.reason ?? new Error(message);
}
