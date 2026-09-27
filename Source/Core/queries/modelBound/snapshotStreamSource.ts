// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { originalFailure } from '../../execution/failureTracking.js';
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
    const failure = originalFailure(result);
    if (failure instanceof SnapshotStreamError) return failure.source;
    if (failure instanceof AggregateError) {
        const snapshot = failure.errors.find((error: unknown) => error instanceof SnapshotStreamError);
        return snapshot instanceof SnapshotStreamError ? snapshot.source : undefined;
    }
    return undefined;
}

/** Release only resources owned by the rejected object; never start a subscription or iterator to clean up. */
export async function releaseSnapshotStream(source: object): Promise<void> {
    const disposable = source as { [Symbol.asyncDispose]?: () => PromiseLike<void>; [Symbol.dispose]?: () => void;
        dispose?: () => void | PromiseLike<void>; close?: () => void | PromiseLike<void>;
        unsubscribe?: () => void | PromiseLike<void>; next?: () => unknown; return?: () => unknown };
    let release: () => unknown;
    if (typeof disposable[Symbol.asyncDispose] === 'function') release = () => disposable[Symbol.asyncDispose]!();
    else if (typeof disposable[Symbol.dispose] === 'function') release = () => disposable[Symbol.dispose]!();
    else if (typeof disposable.dispose === 'function') release = () => disposable.dispose!();
    else if (typeof disposable.close === 'function') release = () => disposable.close!();
    else if (typeof disposable.unsubscribe === 'function') release = () => disposable.unsubscribe!();
    else if (typeof disposable.next === 'function' && typeof disposable.return === 'function')
        release = () => disposable.return!();
    else return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        // Cancellation must not turn a failed release into a successful one; the independent deadline bounds the request.
        await Promise.race([
            Promise.resolve().then(release),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Snapshot stream did not respond to cleanup')), 1_000);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}
