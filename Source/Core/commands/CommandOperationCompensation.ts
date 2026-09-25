// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Outcome of a command operation's compensation attempt. */
export enum CommandOperationCompensation {
    /** No compensation was necessary. */
    NotNeeded = 'NotNeeded',
    /** Compensation finished successfully. */
    Completed = 'Completed',
    /** Compensation failed. */
    Failed = 'Failed',
    /** The operation does not support compensation. */
    NotAvailable = 'NotAvailable',
    /** The compensation time budget expired. */
    BudgetExpired = 'BudgetExpired',
    /** Compensation was suppressed because commitment cannot be ruled out. */
    Suppressed = 'Suppressed'
}
