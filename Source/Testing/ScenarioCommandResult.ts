// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '@cratis/arc.core';

/** Actual pipeline result with explicit, chainable command assertions. */
export interface ScenarioCommandResult<T = unknown> extends CommandResult<T> {
    shouldBeSuccessful(): ScenarioCommandResult<T>;
    shouldNotBeSuccessful(): ScenarioCommandResult<T>;
    shouldBeValid(): ScenarioCommandResult<T>;
    shouldHaveValidationErrors(): ScenarioCommandResult<T>;
    /** Match a validation message fragment (case sensitive), as in .NET. */
    shouldHaveValidationErrorFor(message: string): ScenarioCommandResult<T>;
    /** Match a validated member name rather than unrelated dependency failures. */
    shouldHaveValidationErrorForMember(member: string): ScenarioCommandResult<T>;
    shouldHaveValidationErrorBecauseOf(reason: string): ScenarioCommandResult<T>;
    shouldBeAuthorized(): ScenarioCommandResult<T>;
    shouldNotBeAuthorized(): ScenarioCommandResult<T>;
    shouldHaveExceptions(): ScenarioCommandResult<T>;
    shouldNotHaveExceptions(): ScenarioCommandResult<T>;
    /** Require an operation whose execute method completed (not just entered). */
    shouldHaveExecutedOperation(type: { name: string }): ScenarioCommandResult<T>;
    /** Require a completed compensator; this does not prove atomic reversal. */
    shouldHaveCompensatedOperation(type: { name: string }): ScenarioCommandResult<T>;
    /** Require that no operation entered execute, including partial invocations. */
    shouldHaveNoOperationInvocations(): ScenarioCommandResult<T>;
    /** Require an unknown or mixed commit with indeterminate recovery. */
    shouldHaveIndeterminateRecovery(): ScenarioCommandResult<T>;
}
