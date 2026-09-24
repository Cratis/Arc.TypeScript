// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '@cratis/arc.core';

/** Actual pipeline result with explicit, chainable command assertions. */
export interface ScenarioCommandResult<T = unknown> extends CommandResult<T> {
    shouldBeSuccessful(): ScenarioCommandResult<T>;
    shouldNotBeSuccessful(): ScenarioCommandResult<T>;
    shouldBeValid(): ScenarioCommandResult<T>;
    shouldHaveValidationErrors(): ScenarioCommandResult<T>;
    /** Match a validated member name rather than unrelated dependency failures. */
    shouldHaveValidationErrorFor(member: string): ScenarioCommandResult<T>;
    shouldHaveValidationErrorBecauseOf(reason: string): ScenarioCommandResult<T>;
    shouldBeAuthorized(): ScenarioCommandResult<T>;
    shouldNotBeAuthorized(): ScenarioCommandResult<T>;
    shouldHaveExceptions(): ScenarioCommandResult<T>;
    shouldNotHaveExceptions(): ScenarioCommandResult<T>;
}
