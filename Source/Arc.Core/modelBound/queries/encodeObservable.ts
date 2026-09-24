// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ObservableSource } from '../../queries/observable/ObservableSource.js';
import { encode } from '../reflection/wireSchema.js';

/** Encode each value without changing the source's subscription lifecycle. */
export function encodeObservable(value: unknown): ObservableSource<unknown> {
    if (!value || typeof value !== 'object') throw new Error('Observable query producer must return an async iterable or subscribable');
    const source = value as ObservableSource<unknown>;
    const current = (): { hasValue: false } | { hasValue: true; value: unknown } => {
        if (source.current) {
            const snapshot = source.current();
            return snapshot.hasValue ? { hasValue: true, value: encode(snapshot.value) } : snapshot;
        }
        if ('getValue' in source && typeof source.getValue === 'function')
            return { hasValue: true, value: encode(source.getValue()) };
        if ('value' in source) return { hasValue: true, value: encode(source.value) };
        return { hasValue: false };
    };
    if (Symbol.asyncIterator in source) {
        return {
            current,
            async *[Symbol.asyncIterator]() {
                for await (const emission of source as AsyncIterable<unknown>) yield encode(emission);
            }
        };
    }
    if ('subscribe' in source && typeof source.subscribe === 'function') {
        return {
            current,
            subscribe: observer => source.subscribe({
                next: value => observer.next(encode(value)),
                error: error => observer.error?.(error),
                complete: () => observer.complete?.()
            })
        };
    }
    throw new Error('Observable query producer must return an async iterable or subscribable');
}
