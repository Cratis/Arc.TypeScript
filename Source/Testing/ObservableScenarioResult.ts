// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryResult } from '@cratis/arc.core';

/** Rejected subscription or emissions observed through a live query pipeline. */
export interface ObservableScenarioResult<T> {
    readonly rejection?: QueryResult;
    readonly emissions: readonly QueryResult<T>[];
}
