// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceExecutionState } from './ServiceExecutionState.js';
/** Tracks a participant callback so it cannot await the shutdown draining it. */
export interface ShutdownParticipantFrame {
    state: ServiceExecutionState;
}
