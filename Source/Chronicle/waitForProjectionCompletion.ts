// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AppendResult } from '@cratis/chronicle/eventSequences';

/** Wait for the kernel's observer tail, not a local timer or a read-model polling loop. */
export async function waitForProjectionCompletion(results: readonly AppendResult[], timeoutMs: number | undefined, signal: AbortSignal): Promise<void> {
    if (timeoutMs === undefined || results.length === 0) return;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Chronicle completion timeout must be a positive integer in milliseconds');
    signal.throwIfAborted();
    const last = results[results.length - 1]!;
    // The SDK bounds its RPC with timeoutMs. The Arc signal can cancel the caller's wait as well.
    let onAbort: () => void = () => {};
    const abort = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
        const completion = await Promise.race([last.waitForCompletion(timeoutMs), abort]);
        if (!completion.isSuccess || completion.failedPartitions.length) {
            throw new Error(`Chronicle append committed, but observer completion failed for ${completion.failedPartitions.length} partition(s)`);
        }
    } finally {
        signal.removeEventListener('abort', onAbort);
    }
}
