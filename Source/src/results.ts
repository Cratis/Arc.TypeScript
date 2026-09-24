// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult, ExecutionContext, Paging, QueryResult, ValidationResult } from './contracts.js';

export const emptyPaging = (): Paging => ({ page: 0, size: 0, totalItems: 0, totalPages: 0 });
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
export function queryResult<T>(context: ExecutionContext, values: Partial<QueryResult<T>> = {}): QueryResult<T> {
    const validationResults = values.validationResults ?? [];
    const exceptionMessages = values.exceptionMessages ?? [];
    const isReady = values.isReady ?? true;
    const isAuthorized = values.isAuthorized ?? true;
    const isSuccess = isReady && isAuthorized && validationResults.length === 0 && exceptionMessages.length === 0;
    const result: QueryResult<T> = {
        correlationId: context.correlationId, isReady, isAuthorized, validationResults, exceptionMessages,
        exceptionStackTrace: values.exceptionStackTrace ?? '', paging: values.paging ?? emptyPaging(),
        isValid: validationResults.length === 0, hasExceptions: exceptionMessages.length !== 0, isSuccess
    };
    if (isSuccess && values.data != null) result.data = values.data;
    return result;
}
export function malformed(context: ExecutionContext): ValidationResult[] {
    void context;
    return [{ severity: 3, message: 'Malformed request', members: [], reason: 'malformedRequest' }];
}
export function status(result: CommandResult | QueryResult): number {
    if (result.isSuccess) return 200;
    if (!result.isAuthorized) return 403;
    if (!result.isValid) return 400;
    if ('isReady' in result && !result.isReady) return 202;
    return 500;
}
