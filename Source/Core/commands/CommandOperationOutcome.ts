// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Server-only observation of a single entered operation. */
export interface CommandOperationOutcome {
    readonly invocationIndex: number;
    readonly operationType: string;
    executionCompleted: boolean;
    compensation: 'NotNeeded' | 'Completed' | 'Failed' | 'NotAvailable' | 'BudgetExpired' | 'Suppressed';
    compensationFailure?: string;
}
