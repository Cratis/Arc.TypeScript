// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryContext } from './QueryContext.js';
import type { QueryResult } from './QueryResult.js';

/** A scoped global query filter returning an optional result fragment before performance. */
export interface QueryPipelineFilter {
    onPerform(context: QueryContext): QueryResult | void | Promise<QueryResult | void>;
}
