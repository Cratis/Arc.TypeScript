// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity } from './Severity.js';
import type { ValidationResultOptions } from './ValidationResultOptions.js';

/** A validation issue returned by a command or query. */
export interface ValidationResult {
    severity: Severity;
    message: string;
    members: string[];
    reason: string;
    reasonDetail?: string;
    state?: unknown;
}
export const validation = (message: string, members: string[] = [], reason = 'rule', severity: Severity = Severity.Error): ValidationResult =>
    ({ severity, message, members, reason });

function result(severity: Severity, message: string, options?: ValidationResultOptions): ValidationResult {
    return {
        severity, message, members: options?.members ?? [], reason: options?.reason ?? 'rule',
        ...(options?.state !== undefined && { state: options.state }),
        ...(options?.reasonDetail !== undefined && { reasonDetail: options.reasonDetail })
    };
}

/** Construct validation results at a chosen severity, without positional metadata arguments. */
export const ValidationResult = {
    /** Create an informational result. */
    Information: (message: string, options?: ValidationResultOptions): ValidationResult => result(Severity.Information, message, options),
    /** Create a warning result. */
    Warning: (message: string, options?: ValidationResultOptions): ValidationResult => result(Severity.Warning, message, options),
    /** Create an error result. */
    Error: (message: string, options?: ValidationResultOptions): ValidationResult => result(Severity.Error, message, options)
};
