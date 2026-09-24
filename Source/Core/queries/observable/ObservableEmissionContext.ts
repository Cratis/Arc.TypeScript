// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

/** Isolated snapshot inspected by each guard before an observable result is delivered. */
export interface ObservableEmissionContext {
    readonly queryName: string;
    readonly input: unknown;
    readonly data: unknown;
    readonly context: ExecutionContext;
    readonly isFirstEmission: boolean;
    readonly signal: AbortSignal;
}
