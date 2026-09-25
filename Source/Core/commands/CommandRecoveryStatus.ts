// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Describes observed in-process recovery, not durable or atomic rollback. */
export enum CommandRecoveryStatus {
    /** No started work requires recovery. */
    NotNeeded = 'NotNeeded',
    /** Every required compensator returned successfully. */
    Completed = 'Completed',
    /** Recovery failed, was unavailable, or exhausted its cooperative budget. */
    Incomplete = 'Incomplete',
    /** Recovery was suppressed because business changes committed. */
    Suppressed = 'Suppressed',
    /** Recovery was not attempted because commitment is uncertain or mixed. */
    Indeterminate = 'Indeterminate'
}
