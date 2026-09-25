// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ValidationResult } from '../validation/ValidationResult.js';
import { Severity } from '../validation/Severity.js';

const present = (value: object, field: string): boolean => Object.hasOwn(value, field);
const validSeverity = (value: unknown): value is Severity =>
    typeof value === 'number' && Object.values(Severity).includes(value);

/** Normalize a filter fragment without trusting its runtime shape; denial never exposes validation details. */
export function mergeFilterFragment<T extends { isAuthorized: boolean; validationResults: ValidationResult[];
    exceptionMessages: string[]; exceptionStackTrace: string }>(current: T, fragment: Partial<T>): T {
    if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment) ||
        present(fragment, 'isAuthorized') && typeof fragment.isAuthorized !== 'boolean' ||
        present(fragment, 'isReady') && typeof (fragment as { isReady?: unknown }).isReady !== 'boolean' ||
        ['isValid', 'hasExceptions', 'isSuccess'].some(field => present(fragment, field) &&
            typeof (fragment as Record<string, unknown>)[field] !== 'boolean') ||
        present(fragment, 'authorizationFailureReason') &&
            typeof (fragment as { authorizationFailureReason?: unknown }).authorizationFailureReason !== 'string' ||
        present(fragment, 'validationResults') && (!Array.isArray(fragment.validationResults) ||
            !fragment.validationResults.every(item => item && typeof item === 'object' &&
                validSeverity(item.severity) && typeof item.message === 'string' &&
                Array.isArray(item.members) && item.members.every((member: unknown) => typeof member === 'string') &&
                typeof item.reason === 'string' &&
                (!present(item, 'reasonDetail') || typeof item.reasonDetail === 'string'))) ||
        present(fragment, 'exceptionMessages') && (!Array.isArray(fragment.exceptionMessages) ||
            !fragment.exceptionMessages.every(item => typeof item === 'string')) ||
        present(fragment, 'exceptionStackTrace') && typeof fragment.exceptionStackTrace !== 'string')
        throw new TypeError('Invalid filter result fragment');
    const isAuthorized = current.isAuthorized && fragment.isAuthorized !== false;
    return {
        ...current, isAuthorized,
        validationResults: isAuthorized ? [...current.validationResults, ...fragment.validationResults ?? []] : [],
        exceptionMessages: [...current.exceptionMessages, ...fragment.exceptionMessages ?? []],
        exceptionStackTrace: [current.exceptionStackTrace, fragment.exceptionStackTrace].filter(Boolean).join('\n')
    };
}
