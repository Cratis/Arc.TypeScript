// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ValidationResult } from '../validation/ValidationResult.js';
import { Severity } from '../validation/Severity.js';

const invalid = (): never => { throw new TypeError('Invalid filter result fragment'); };

// Missing fields are allowed; inherited decision fields are not. Accessors are evaluated exactly once.
function own(value: object, field: string): { present: boolean; value: unknown } {
    if (!Object.hasOwn(value, field)) {
        if (field in value) invalid();
        return { present: false, value: undefined };
    }
    return { present: true, value: (value as Record<string, unknown>)[field] };
}

function dense<T>(value: unknown, convert: (item: unknown) => T): T[] {
    if (!Array.isArray(value)) return invalid();
    const result: T[] = [];
    const length = value.length;
    for (let index = 0; index < length; index++) {
        if (!Object.hasOwn(value, index)) invalid();
        result.push(convert(value[index]));
    }
    return result;
}

function string(value: unknown): string {
    if (typeof value !== 'string') return invalid();
    return value;
}

function validation(value: unknown): ValidationResult {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
    const severity = own(value, 'severity').value;
    const message = own(value, 'message').value;
    const members = own(value, 'members').value;
    const reason = own(value, 'reason').value;
    const detail = own(value, 'reasonDetail');
    if (typeof severity !== 'number' || !Object.values(Severity).includes(severity)) return invalid();
    const result: ValidationResult = {
        severity, message: string(message), members: dense(members, string), reason: string(reason)
    };
    if (detail.present) result.reasonDetail = string(detail.value);
    const state = own(value, 'state');
    if (state.present) result.state = state.value;
    return result;
}

/** Normalize a filter fragment without trusting its runtime shape; denial never exposes validation details. */
export function mergeFilterFragment<T extends { isAuthorized: boolean; validationResults: ValidationResult[];
    exceptionMessages: string[]; exceptionStackTrace: string; isReady?: boolean; authorizationFailureReason?: string }>(current: T, fragment: Partial<T>): T {
    if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment)) invalid();
    const authorization = own(fragment, 'isAuthorized');
    const readiness = own(fragment, 'isReady');
    const reason = own(fragment, 'authorizationFailureReason');
    const results = own(fragment, 'validationResults');
    const messages = own(fragment, 'exceptionMessages');
    const stack = own(fragment, 'exceptionStackTrace');
    for (const field of ['isValid', 'hasExceptions', 'isSuccess']) {
        const flag = own(fragment, field);
        if (flag.present && typeof flag.value !== 'boolean') invalid();
    }
    if (authorization.present && typeof authorization.value !== 'boolean' ||
        readiness.present && typeof readiness.value !== 'boolean' ||
        reason.present && typeof reason.value !== 'string' ||
        stack.present && typeof stack.value !== 'string') invalid();
    const normalizedResults = results.present ? dense(results.value, validation) : [];
    const normalizedMessages = messages.present ? dense(messages.value, string) : [];
    const isAuthorized = current.isAuthorized && authorization.value !== false;
    return {
        ...current, isAuthorized,
        ...readiness.present && { isReady: current.isReady !== false && readiness.value !== false },
        ...reason.present && { authorizationFailureReason: current.authorizationFailureReason || reason.value },
        validationResults: isAuthorized ? [...current.validationResults, ...normalizedResults] : [],
        exceptionMessages: [...current.exceptionMessages, ...normalizedMessages],
        exceptionStackTrace: [current.exceptionStackTrace, stack.value].filter(Boolean).join('\n')
    } as T;
}
