// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryContext } from './QueryContext.js';
import type { QueryResult } from './QueryResult.js';
import { queryResult } from './createQueryResult.js';

/** Create a query filter result fragment for the current correlation ID. */
export function queryFilterResult(context: QueryContext, values: Partial<QueryResult> = {}): QueryResult {
    return queryResult(context, values);
}
