// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ValidationResult } from '../validation/ValidationResult.js';

/** Normalize a filter fragment without trusting its runtime shape; denial never exposes validation details. */
export function mergeFilterFragment<T extends { isAuthorized: boolean; validationResults: ValidationResult[];
    exceptionMessages: string[]; exceptionStackTrace: string }>(current: T, fragment: Partial<T>): T {
    if (!fragment || typeof fragment !== 'object' ||
        fragment.validationResults !== undefined && !Array.isArray(fragment.validationResults) ||
        fragment.exceptionMessages !== undefined && !Array.isArray(fragment.exceptionMessages))
        throw new TypeError('Invalid filter result fragment');
    const isAuthorized = current.isAuthorized && fragment.isAuthorized !== false;
    return {
        ...current, isAuthorized,
        validationResults: isAuthorized ? [...current.validationResults, ...fragment.validationResults ?? []] : [],
        exceptionMessages: [...current.exceptionMessages, ...fragment.exceptionMessages ?? []],
        exceptionStackTrace: [current.exceptionStackTrace, fragment.exceptionStackTrace].filter(Boolean).join('\n')
    };
}
