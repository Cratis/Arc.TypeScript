// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ObservableSource } from './ObservableSource.js';
import type { Subscribable } from './Subscribable.js';

const maximumPending = 64;
const aborted = (): Error => new Error('Observable query subscription was canceled');

/** Convert a structural observable or async iterable into a cancellable, bounded stream. */
export async function* toEmissions<T>(source: ObservableSource<T>, signal: AbortSignal): AsyncGenerator<T> {
    if (Symbol.asyncIterator in source) {
        const iterator = (source as AsyncIterable<T>)[Symbol.asyncIterator]();
        try {
            while (!signal.aborted) {
                const next = await new Promise<IteratorResult<T>>((resolve, reject) => {
                    const cancel = (): void => reject(aborted());
                    signal.addEventListener('abort', cancel, { once: true });
                    void iterator.next().then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
                });
                if (next.done) return;
                yield next.value;
            }
        } finally {
            await iterator.return?.();
        }
        return;
    }
    const pending: T[] = [];
    let wake: (() => void) | undefined;
    let finished = false;
    let failure: unknown;
    const notify = (): void => { wake?.(); wake = undefined; };
    const subscription = (source as Subscribable<T>).subscribe({
        next(value) {
            if (finished) return;
            if (pending.length >= maximumPending) {
                failure = new Error('Observable query outbound queue is full');
                finished = true;
            } else pending.push(value);
            notify();
        },
        error(error) { failure = error; finished = true; notify(); },
        complete() { finished = true; notify(); }
    });
    const cancel = (): void => { finished = true; notify(); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        while (!signal.aborted) {
            if (failure !== undefined) throw failure;
            if (pending.length) { yield pending.shift()!; continue; }
            if (finished) return;
            await new Promise<void>(resolve => { wake = resolve; });
        }
    } finally {
        signal.removeEventListener('abort', cancel);
        if (typeof subscription === 'function') subscription();
        else subscription.unsubscribe();
    }
}
