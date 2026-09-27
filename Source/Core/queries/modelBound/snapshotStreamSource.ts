// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentLateFailureReporter, originalFailure } from '../../execution/failureTracking.js';
import type { QueryResult } from '../QueryResult.js';

/** Carries a rejected snapshot source through the query pipeline for diagnostics. */
export class SnapshotStreamError extends Error {
    readonly source: object;
    constructor(message: string, source: object) {
        super(message);
        this.name = 'SnapshotStreamError';
        this.source = source;
        Object.defineProperty(this, 'source', { enumerable: false });
    }
}

/** Return the rejected source of a snapshot query only when its original pipeline failure is a snapshot stream rejection. Arc releases it first if it owns a disposal hook. */
export function snapshotStreamSource(result: QueryResult): object | undefined {
    const seen = new Set<object>();
    const find = (failure: unknown, depth: number): SnapshotStreamError | undefined => {
        if (failure instanceof SnapshotStreamError) return failure;
        if (depth >= 32 || !failure || typeof failure !== 'object' || seen.has(failure)) return undefined;
        seen.add(failure);
        if (failure instanceof AggregateError) {
            for (const error of failure.errors) {
                const snapshot = find(error, depth + 1);
                if (snapshot) return snapshot;
            }
        }
        return failure instanceof Error ? find(failure.cause, depth + 1) : undefined;
    };
    return find(originalFailure(result), 0)?.source;
}

/** Release only resources owned by the rejected object; never start a subscription or iterator to clean up. */
export async function releaseSnapshotStream(source: object): Promise<void> {
    const disposable = source as { [Symbol.asyncDispose]?: () => PromiseLike<void>; [Symbol.dispose]?: () => void;
        dispose?: () => void | PromiseLike<void>; close?: () => void | PromiseLike<void>;
        next?: () => unknown; return?: () => unknown };
    let release: () => unknown;
    if (typeof disposable[Symbol.asyncDispose] === 'function') release = () => disposable[Symbol.asyncDispose]!();
    else if (typeof disposable[Symbol.dispose] === 'function') release = () => disposable[Symbol.dispose]!();
    else if (typeof disposable.dispose === 'function') release = () => disposable.dispose!();
    else if (typeof disposable.close === 'function') release = () => disposable.close!();
    else if (typeof disposable.next === 'function' && typeof disposable.return === 'function')
        release = () => disposable.return!();
    else return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    const reportLateFailure = currentLateFailureReporter();
    const attempt = Promise.resolve().then(release);
    // The race handles an on-time rejection; after the deadline, report the eventual failure too.
    void attempt.catch(error => { if (expired) reportLateFailure(error); });
    try {
        // Cancellation must not turn a failed release into a successful one; the independent deadline bounds the request.
        await Promise.race([
            attempt,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    expired = true;
                    reject(new Error('Snapshot stream did not respond to cleanup'));
                }, 1_000);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}
