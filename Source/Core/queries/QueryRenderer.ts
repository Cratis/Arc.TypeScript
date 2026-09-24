// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { QueryOptions } from './QueryOptions.js';
import type { QueryPage } from './QueryPage.js';

/** Scoped renderer for a provider-owned result; return a page with its authoritative total and sorting. */
export interface QueryRenderer {
    canRender(value: unknown): boolean;
    render(value: unknown, context: ExecutionContext, options: QueryOptions): QueryPage<unknown> | unknown | Promise<QueryPage<unknown> | unknown>;
}
