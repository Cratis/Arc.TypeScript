// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { CommandResult } from './CommandResult.js';
import type { CommandCommitDisposition } from './CommandCommitDisposition.js';
export interface CommandExecutionScope { begin(context: ExecutionContext): void | Promise<void>; complete(context: ExecutionContext, result: CommandResult): void | Promise<void> }
/** An operation-compatible scope must report authoritative commitment facts, even after completion fails. */
export interface CommandOperationExecutionScope extends CommandExecutionScope {
    readonly isCommitParticipant: boolean;
    getCommitDisposition(context: ExecutionContext): CommandCommitDisposition;
}
