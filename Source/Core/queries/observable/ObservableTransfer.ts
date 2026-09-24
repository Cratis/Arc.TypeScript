// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryResult } from '../QueryResult.js';
import { stringifyNamedFloats } from '../../reflection/stringifyWire.js';
import { computeChangeSet } from './computeChangeSet.js';
import { ObservableTransferMode } from './ObservableTransferMode.js';

/** Computes changes only against acknowledged, post-rendered full snapshots. */
export class ObservableTransfer {
    readonly #mode: ObservableTransferMode;
    #previous: unknown[] | undefined;

    constructor(preference?: string) {
        this.#mode = preference === ObservableTransferMode.Full ? ObservableTransferMode.Full
            : preference === ObservableTransferMode.Delta ? ObservableTransferMode.Delta
                : ObservableTransferMode.Legacy;
    }

    /** Prepare a frame without advancing the baseline until its write succeeds. */
    prepare(result: QueryResult): { payload: QueryResult; commit(): void } {
        const serialized = result.data === undefined ? undefined : stringifyNamedFloats(result.data);
        const current = serialized === undefined ? undefined : JSON.parse(serialized) as unknown;
        if (!Array.isArray(current) || this.#mode === ObservableTransferMode.Full) {
            return { payload: { ...result, ...(current === undefined ? {} : { data: current }) }, commit() {} };
        }
        const changeSet = computeChangeSet(this.#previous ?? [], current);
        const first = this.#previous === undefined;
        const commit = (): void => { this.#previous = current; };
        if (this.#mode === ObservableTransferMode.Delta) {
            if (first) return { payload: { ...result, data: current }, commit };
            const payload: QueryResult = { ...result, changeSet };
            delete payload.data;
            return { payload, commit };
        }
        return { payload: { ...result, data: current, changeSet }, commit };
    }
}
