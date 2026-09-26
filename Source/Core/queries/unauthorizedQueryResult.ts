// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryContext } from './QueryContext.js';
import type { QueryResult } from './QueryResult.js';
import { queryResult } from './createQueryResult.js';

/** Deny a query without disclosing data or validation details. */
export function unauthorizedQueryResult(context: QueryContext): QueryResult {
    return queryResult(context, { isAuthorized: false });
}
