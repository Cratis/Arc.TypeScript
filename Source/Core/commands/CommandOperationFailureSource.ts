// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Phase in which the original command failure was observed. */
export enum CommandOperationFailureSource {
    /** A control value or response handler rejected the command. */
    ResponseHandling = 'response',
    /** An operation threw. */
    Execution = 'execution',
    /** Forward execution was canceled. */
    Cancellation = 'cancellation',
    /** An execution scope failed or rejected completion. */
    ScopeCompletion = 'scope'
}
