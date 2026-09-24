// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ValidationResult } from '../validation/ValidationResult.js';
import type { Paging } from './Paging.js';
import type { ChangeSet } from './observable/ChangeSet.js';
export interface QueryResult<T = unknown> {
    correlationId: string;
    data?: T;
    changeSet?: ChangeSet<unknown>;
    isReady: boolean;
    isAuthorized: boolean;
    validationResults: ValidationResult[];
    exceptionMessages: string[];
    exceptionStackTrace: string;
    paging: Paging;
    isValid: boolean;
    hasExceptions: boolean;
    isSuccess: boolean;
}
