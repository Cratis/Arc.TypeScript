// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Observed compensation outcome for one started invocation. */
export enum CommandOperationCompensation {
    /** Compensation was not required. */
    NotNeeded = 'NotNeeded',
    /** The compensator returned. */
    Completed = 'Completed',
    /** The compensator threw. */
    Failed = 'Failed',
    /** No compensator was declared. */
    NotAvailable = 'NotAvailable',
    /** The cooperative recovery budget expired before entry. */
    BudgetExpired = 'BudgetExpired',
    /** Commitment facts prohibit automatic reversal. */
    Suppressed = 'Suppressed'
}
