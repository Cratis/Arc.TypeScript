// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Consistency requested when reading a Chronicle read model. */
export enum ChronicleReadConsistency {
    /** Read the stored model. */
    Default = 'default',
    /** Compute from the event log immediately; only valid for passive model-bound projections. Active models are rejected. */
    Immediate = 'immediate'
}
