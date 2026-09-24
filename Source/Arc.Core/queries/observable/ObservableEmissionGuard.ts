// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ObservableEmissionContext } from './ObservableEmissionContext.js';
import type { ObservableEmissionDecision } from './ObservableEmissionDecision.js';

/** A scoped policy evaluated for every rendered observable result, including current-value snapshots. */
export interface ObservableEmissionGuard {
    check(emission: ObservableEmissionContext): ObservableEmissionDecision | Promise<ObservableEmissionDecision>;
}
