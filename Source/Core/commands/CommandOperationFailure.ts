// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandCommitDisposition } from './CommandCommitDisposition.js';
import type { CommandOperationFailureSource } from './CommandOperationFailureSource.js';
/** Snapshot of the original failure passed to a compensator, never to the client. */
export interface CommandOperationFailure {
    readonly invocationIndex: number;
    readonly invocationCompleted: boolean;
    readonly isFailingInvocation: boolean;
    readonly source: CommandOperationFailureSource;
    readonly commitDisposition: CommandCommitDisposition;
    readonly exceptionMessages: readonly string[];
}
