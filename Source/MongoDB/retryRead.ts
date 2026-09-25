// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { MongoError, MongoNetworkError, MongoServerSelectionError } from 'mongodb';

/** Retry only idempotent reads with recognized transient driver errors; never turn a failed read into an empty result. */
export async function retryRead<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        try { return await read(); }
        catch (error) {
            if (attempt >= 2 || !(error instanceof MongoNetworkError || error instanceof MongoServerSelectionError ||
                error instanceof MongoError && error.hasErrorLabel('RetryableReadError')) || signal.aborted) throw error;
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 100 * (attempt + 1));
                const abort = () => { clearTimeout(timer); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
                signal.addEventListener('abort', abort, { once: true });
                if (signal.aborted) abort();
            });
        }
    }
}
