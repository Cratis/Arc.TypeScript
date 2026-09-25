// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { ValidationResult } from '../validation/ValidationResult.js';

export function malformed(context: ExecutionContext): ValidationResult[] {
    void context;
    return [{ severity: 3, message: 'Malformed request', members: [], reason: 'malformedRequest' }];
}
