// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity } from './Severity.js';

export function allowedSeverity(value: string | null): Severity {
    return value !== null && /^[0-3]$/.test(value) ? Number(value) as Severity : Severity.Warning;
}
