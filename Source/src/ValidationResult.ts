// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity } from './Severity.js';
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
