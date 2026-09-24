// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext, ValidationResult } from '../index.js';

export function malformed(context: ExecutionContext): ValidationResult[] {
    void context;
    return [{ severity: 3, message: 'Malformed request', members: [], reason: 'malformedRequest' }];
}
