// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { originalFailure } from '../../execution/failureTracking.js';
import type { QueryResult } from '../QueryResult.js';

/** Carries a rejected snapshot source to scenario-owned cleanup without taking ownership in production. */
export class SnapshotStreamError extends Error {
    readonly source: object;
    constructor(message: string, source: object) {
        super(message);
        this.name = 'SnapshotStreamError';
        this.source = source;
        Object.defineProperty(this, 'source', { enumerable: false });
    }
}

/** Return the rejected source of a snapshot query only when its original pipeline failure is a snapshot stream rejection. Consumers that own the source may use this for cleanup; the production pipeline never takes ownership. */
export function snapshotStreamSource(result: QueryResult): object | undefined {
    const failure = originalFailure(result);
    if (failure instanceof SnapshotStreamError) return failure.source;
    if (failure instanceof AggregateError) {
        const snapshot = failure.errors.find((error: unknown) => error instanceof SnapshotStreamError);
        return snapshot instanceof SnapshotStreamError ? snapshot.source : undefined;
    }
    return undefined;
}
