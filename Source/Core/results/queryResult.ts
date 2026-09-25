// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { QueryResult } from '../queries/QueryResult.js';
import { emptyPaging } from './emptyPaging.js';

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
