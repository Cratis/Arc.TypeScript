// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Integration-reported facts about the coordinated business commit, independent of command success. */
export enum CommandCommitDisposition {
    /** No coordinated commit participant exists. */
    NoCommit = 'NoCommit',
    /** All coordinated changes are known not committed. */
    NotCommitted = 'NotCommitted',
    /** The coordinated business boundary committed. */
    Committed = 'Committed',
    /** Commitment cannot be established safely. */
    Unknown = 'Unknown',
    /** Some changes committed and others did not. */
    Mixed = 'Mixed'
}
