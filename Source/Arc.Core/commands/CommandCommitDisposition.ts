// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Explicit business-commit facts from the sole deferred commit participant. */
export type CommandCommitDisposition = 'NoCommit' | 'NotCommitted' | 'Committed' | 'Unknown' | 'Mixed';
