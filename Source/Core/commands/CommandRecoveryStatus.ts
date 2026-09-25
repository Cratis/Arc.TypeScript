// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Overall recovery outcome for a command operation. */
export enum CommandRecoveryStatus {
    /** Recovery was not needed. */
    NotNeeded = 'NotNeeded',
    /** All started operations were compensated. */
    Completed = 'Completed',
    /** At least one started operation was not compensated. */
    Incomplete = 'Incomplete',
    /** Recovery was suppressed after commitment. */
    Suppressed = 'Suppressed',
    /** The commitment outcome was uncertain. */
    Indeterminate = 'Indeterminate'
}
