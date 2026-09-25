// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ConcurrencyScope, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import type { AggregateRoot } from './AggregateRoot.js';

/** The aggregate's pending events, committed by the command's Chronicle scope. */
export class AggregateRootCommitResult {
    constructor(readonly aggregate: AggregateRoot, readonly events: readonly EventForEventSourceId[],
        readonly scopes: Readonly<Record<string, ConcurrencyScope>>, readonly start: number) {}
}
