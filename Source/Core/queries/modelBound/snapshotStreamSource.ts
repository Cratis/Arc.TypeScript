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

/** Return the rejected source of a snapshot query only when its original pipeline failure is a snapshot stream rejection. Arc closes this source before reporting the failure. */
export function snapshotStreamSource(result: QueryResult): object | undefined {
    const failure = originalFailure(result);
    if (failure instanceof SnapshotStreamError) return failure.source;
    if (failure instanceof AggregateError) {
        const snapshot = failure.errors.find((error: unknown) => error instanceof SnapshotStreamError);
        return snapshot instanceof SnapshotStreamError ? snapshot.source : undefined;
    }
    return undefined;
}

/** Close a rejected snapshot stream without closing other subscribers of a shared source. */
export async function releaseSnapshotStream(source: object, signal: AbortSignal): Promise<void> {
    const disposable = source as { [Symbol.asyncDispose]?: () => PromiseLike<void>; [Symbol.dispose]?: () => void;
        unsubscribe?: () => void | PromiseLike<void>; dispose?: () => void | PromiseLike<void>;
        [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
        subscribe?: (observer: { next(value: unknown): void; error(error: unknown): void; complete(): void }) =>
            { unsubscribe(): void | PromiseLike<void> } | (() => void | PromiseLike<void>) };
    let release: () => unknown;
    if (typeof disposable[Symbol.asyncIterator] === 'function') release = () => disposable[Symbol.asyncIterator]!().return?.();
    else if (typeof disposable[Symbol.asyncDispose] === 'function') release = () => disposable[Symbol.asyncDispose]!();
    else if (typeof disposable[Symbol.dispose] === 'function') release = () => disposable[Symbol.dispose]!();
    else if (typeof disposable.subscribe === 'function') release = () => {
        const subscription = disposable.subscribe!({ next() {}, error() {}, complete() {} });
        if (typeof subscription === 'function') return subscription();
        if (subscription && typeof subscription.unsubscribe === 'function') return subscription.unsubscribe();
        if (typeof disposable.unsubscribe === 'function') return disposable.unsubscribe();
        return disposable.dispose?.();
    };
    else return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    try {
        await Promise.race([
            Promise.resolve().then(release),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Snapshot stream did not respond to cleanup')), 1_000);
            }),
            new Promise<void>(resolve => {
                cancel = resolve;
                signal.addEventListener('abort', cancel, { once: true });
                if (signal.aborted) resolve();
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
        if (cancel) signal.removeEventListener('abort', cancel);
    }
}
