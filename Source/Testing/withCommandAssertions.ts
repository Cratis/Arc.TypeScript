// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AssertionError } from 'node:assert';
import type { CommandResult } from '@cratis/arc.core';
import type { ScenarioCommandResult } from './ScenarioCommandResult.js';

/** Decorate one actual pipeline result without patching the global command prototype. */
export function withCommandAssertions<T>(result: CommandResult<T>): ScenarioCommandResult<T> {
    const assert = (condition: boolean, message: string): ScenarioCommandResult<T> => {
        if (!condition) throw new AssertionError({ message });
        return decorated;
    };
    const decorated: ScenarioCommandResult<T> = Object.assign(result, {
        shouldBeSuccessful: () => assert(result.isSuccess, `Expected command to be successful: ${[
            ...result.validationResults.map(item => item.message), ...result.exceptionMessages,
            ...!result.isAuthorized ? [result.authorizationFailureReason] : []].join(', ')}`),
        shouldNotBeSuccessful: () => assert(!result.isSuccess, 'Expected command to not be successful'),
        shouldBeValid: () => assert(result.isValid, 'Expected command to be valid'),
        shouldHaveValidationErrors: () => assert(result.validationResults.some(item =>
            item.reason !== 'dependencyUnavailable' && item.reason !== 'validatorFailed'),
        'Expected authored validation errors; dependency or validator failures alone do not satisfy this assertion'),
        shouldHaveValidationErrorFor: (member: string) => assert(result.validationResults.some(item =>
            item.members.includes(member) && item.reason !== 'dependencyUnavailable' && item.reason !== 'validatorFailed'),
        `Expected validation error for '${member}'`),
        shouldHaveValidationErrorBecauseOf: (reason: string) => assert(result.validationResults.some(item => item.reason === reason),
            `Expected validation error because of '${reason}'`),
        shouldBeAuthorized: () => assert(result.isAuthorized, `Expected command to be authorized: ${result.authorizationFailureReason}`),
        shouldNotBeAuthorized: () => assert(!result.isAuthorized, 'Expected command to not be authorized'),
        shouldHaveExceptions: () => assert(result.hasExceptions, 'Expected command to have exceptions'),
        shouldNotHaveExceptions: () => assert(!result.hasExceptions, `Expected command to have no exceptions: ${result.exceptionMessages.join(', ')}`)
    });
    return decorated;
}
