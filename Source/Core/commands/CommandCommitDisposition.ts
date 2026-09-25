// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Explicit business-commit facts from the sole deferred commit participant. */
/** Observed disposition of the command's coordinated commit. */
export enum CommandCommitDisposition {
    /** No commit was requested. */
    NoCommit = 'NoCommit',
    /** The command was not committed. */
    NotCommitted = 'NotCommitted',
    /** The command was committed. */
    Committed = 'Committed',
    /** The commit outcome is unknown. */
    Unknown = 'Unknown',
    /** Participants reported mixed commit outcomes. */
    Mixed = 'Mixed'
}
