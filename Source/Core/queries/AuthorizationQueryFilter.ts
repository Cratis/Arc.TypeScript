// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryContext } from './QueryContext.js';
import type { QueryResult } from './QueryResult.js';

/** A scoped global query admission gate, evaluated once before validator dependencies. */
export interface AuthorizationQueryFilter {
    onPerform(context: QueryContext): QueryResult | void | Promise<QueryResult | void>;
}
