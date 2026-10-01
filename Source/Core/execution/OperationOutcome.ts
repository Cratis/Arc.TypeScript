// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Bounded operation outcomes shared with Arc for .NET. */
export enum OperationOutcome {
    Success = 'success',
    Validation = 'validation',
    Authorization = 'authorization',
    AppendRejected = 'append_rejected',
    Cancelled = 'cancelled',
    Error = 'error'
}
