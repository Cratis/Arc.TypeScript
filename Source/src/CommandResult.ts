// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ValidationResult } from './ValidationResult.js';
export interface CommandResult<T = unknown> {
    correlationId: string;
    isAuthorized: boolean;
    validationResults: ValidationResult[];
    exceptionMessages: string[];
    exceptionStackTrace: string;
    authorizationFailureReason: string;
    isValid: boolean;
    hasExceptions: boolean;
    isSuccess: boolean;
    response?: T;
}
