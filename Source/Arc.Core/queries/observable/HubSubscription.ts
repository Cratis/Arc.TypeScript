// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ObservableQuerySession } from './ObservableQuerySession.js';
import type { ObservableTransfer } from './ObservableTransfer.js';
import type { HubSubscriptionOutcome } from './HubSubscriptionOutcome.js';

/** One generation of a query id; stale callbacks compare object identity before writing. */
export interface HubSubscription {
    readonly queryId: string;
    readonly queryName: string;
    readonly connectedAt: string;
    lastDataServedAt?: string;
    readonly revision?: number;
    readonly transfer: ObservableTransfer;
    readonly controller: AbortController;
    session?: ObservableQuerySession;
    admission?: Promise<HubSubscriptionOutcome>;
    delivery?: Promise<void>;
}
