// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from './CommandContext.js';
import type { CommandResult } from './CommandResult.js';
import { commandResult } from '../results/commandResult.js';
import { hasFailure, originalFailure, recordFailure } from '../results/failureTracking.js';
/** Preserve the first failure even if a completion scope mutates the result. */
export class CommandFailureSnapshot {
    original?: CommandResult;
    constructor(private readonly context: CommandContext) {}
    capture(result: CommandResult): void {
        if (result.isSuccess || this.original) return;
        this.original = commandResult(this.context, {
            isAuthorized: result.isAuthorized, authorizationFailureReason: result.authorizationFailureReason,
            validationResults: [...result.validationResults], exceptionMessages: [...result.exceptionMessages],
            exceptionStackTrace: result.exceptionStackTrace
        });
        if (hasFailure(result)) recordFailure(this.original, originalFailure(result));
    }
    restore(result: CommandResult): CommandResult {
        const snapshot = this.original;
        if (!snapshot) return result;
        const merged = commandResult(this.context, {
            isAuthorized: result.isAuthorized && snapshot.isAuthorized,
            authorizationFailureReason: result.authorizationFailureReason || snapshot.authorizationFailureReason,
            validationResults: [...snapshot.validationResults, ...result.validationResults.filter(item => !snapshot.validationResults.includes(item))],
            exceptionMessages: [...snapshot.exceptionMessages, ...result.exceptionMessages.filter(item => !snapshot.exceptionMessages.includes(item))],
            exceptionStackTrace: snapshot.exceptionStackTrace || result.exceptionStackTrace
        });
        if (hasFailure(result)) recordFailure(merged, originalFailure(result));
        else if (hasFailure(snapshot)) recordFailure(merged, originalFailure(snapshot));
        return merged;
    }
}
