// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AppendResult } from '@cratis/chronicle/eventSequences';

/** Wait for the kernel's observer tail, not a local timer or a read-model polling loop. */
export async function waitForProjectionCompletion(results: readonly AppendResult[], timeoutMs: number | undefined, signal: AbortSignal): Promise<void> {
    if (timeoutMs === undefined || results.length === 0) return;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Chronicle completion timeout must be a positive integer in milliseconds');
    if (signal.aborted) return;
    const last = results[results.length - 1]!;
    // Cancellation stops waiting, not the acknowledged append. An observer failure remains an error.
    let onAbort: () => void = () => {};
    const abort = new Promise<{ canceled: true }>(resolve => {
        onAbort = () => resolve({ canceled: true });
        signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
        const outcome = await Promise.race([last.waitForCompletion(timeoutMs).then(completion => ({ canceled: false as const, completion })), abort]);
        if (outcome.canceled) return;
        const { completion } = outcome;
        if (!completion.isSuccess || completion.failedPartitions.length) {
            throw new Error(`Chronicle append committed, but observer completion failed for ${completion.failedPartitions.length} partition(s)`);
        }
    } finally {
        signal.removeEventListener('abort', onAbort);
    }
}
