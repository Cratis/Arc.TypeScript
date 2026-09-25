// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../commands/CommandResult.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';

export function commandResult<T>(context: ExecutionContext, values: Partial<CommandResult<T>> = {}): CommandResult<T> {
    const validationResults = values.validationResults ?? [];
    const exceptionMessages = values.exceptionMessages ?? [];
    const isAuthorized = values.isAuthorized ?? true;
    const isSuccess = isAuthorized && validationResults.length === 0 && exceptionMessages.length === 0;
    const result: CommandResult<T> = {
        correlationId: context.correlationId, isAuthorized, validationResults, exceptionMessages,
        exceptionStackTrace: values.exceptionStackTrace ?? '', authorizationFailureReason: values.authorizationFailureReason ?? '',
        isValid: validationResults.length === 0, hasExceptions: exceptionMessages.length !== 0, isSuccess
    };
    if (isSuccess && values.response != null) result.response = values.response;
    return result;
}
