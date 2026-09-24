// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandCommitDisposition } from './CommandCommitDisposition.js';
/** Server-only aggregate of attempted operation recovery. */
export interface CommandRecoverySummary {
    readonly commitDisposition: CommandCommitDisposition;
    readonly status: 'NotNeeded' | 'Completed' | 'Incomplete' | 'Suppressed' | 'Indeterminate';
    readonly startedCount: number;
    readonly completedCount: number;
    readonly compensatedCount: number;
    readonly failedCompensationCount: number;
    readonly uncompensatedCount: number;
}
