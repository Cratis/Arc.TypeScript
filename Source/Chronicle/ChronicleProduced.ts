// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { EventForEventSourceId } from '@cratis/chronicle/eventSequences';

/** One explicit, nontransactional event-log batch. Empty events deliberately mean no persistence. */
export interface ChronicleProduced<T> {
    readonly events: readonly EventForEventSourceId[];
    readonly response?: T;
}
