// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { originalFailure } from '../../execution/failureTracking.js';
import type { QueryResult } from '../QueryResult.js';

/** Carries a rejected snapshot source to scenario-owned cleanup without taking ownership in production. */
export class SnapshotStreamError extends Error {
    constructor(message: string, readonly source: object) { super(message); }
}

/** @internal Return a rejected snapshot's source only when it is the pipeline's original failure. */
export function snapshotStreamSource(result: QueryResult): object | undefined {
    const failure = originalFailure(result);
    if (failure instanceof SnapshotStreamError) return failure.source;
    if (failure instanceof AggregateError) {
        const snapshot = failure.errors.find((error: unknown) => error instanceof SnapshotStreamError);
        return snapshot instanceof SnapshotStreamError ? snapshot.source : undefined;
    }
    return undefined;
}
