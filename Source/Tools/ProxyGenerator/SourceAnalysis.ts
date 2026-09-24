// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SourceModel } from './SourceModel.js';
import type { SourceOperation } from './SourceOperation.js';
import type { RecordedRule } from './RecordedRule.js';
export interface SourceAnalysis {
    readonly operations: readonly SourceOperation[];
    readonly models: readonly SourceModel[];
    readonly recordedRules?: ReadonlyMap<string, readonly RecordedRule[]>;
    readonly diagnostics?: readonly string[];
}
