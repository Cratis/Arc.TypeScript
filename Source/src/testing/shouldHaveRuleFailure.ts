// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ValidationResult } from '../ValidationResult.js';
/** A dependency/validator failure cannot satisfy an authored business-rule assertion. */
export function shouldHaveRuleFailure(result: { validationResults: readonly ValidationResult[]; correlationId: string },
    expected: { reason: string; member?: string; severity?: number; correlationId?: string }): void {
    const found = result.validationResults.some(item => item.reason === expected.reason &&
        item.reason !== 'dependencyUnavailable' && item.reason !== 'validatorFailed' &&
        (expected.member === undefined || item.members.includes(expected.member)) &&
        (expected.severity === undefined || item.severity === expected.severity));
    if (!found || expected.correlationId !== undefined && result.correlationId !== expected.correlationId)
        throw new Error(`Expected authored rule failure: ${expected.reason}`);
}
