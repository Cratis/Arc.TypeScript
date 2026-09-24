// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ConcurrencyScope } from '@cratis/chronicle/eventSequences';
/** A server-authored batch with exact read revisions; scope labels need not be append targets. */
export class EventsWithConcurrencyScopes {
    constructor(readonly events: readonly unknown[], readonly scopes: Readonly<Record<string, ConcurrencyScope>>) {}
}
/** Explicitly associate returned events with exact server-side concurrency scopes. */
export function eventsWithConcurrencyScopes(events: readonly unknown[], scopes: Readonly<Record<string, ConcurrencyScope>>): EventsWithConcurrencyScopes {
    return new EventsWithConcurrencyScopes(events, scopes);
}
