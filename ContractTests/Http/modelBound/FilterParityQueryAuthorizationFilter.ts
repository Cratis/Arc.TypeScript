// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorizationQueryFilter, unauthorizedQueryResult,
    type AuthorizationQueryFilter, type QueryContext, type QueryResult } from '@cratis/arc.core';
import { recordFilterParity } from './FilterParityObservations.js';

/** Deny selected query arguments before validation. */
@authorizationQueryFilter()
export class FilterParityQueryAuthorizationFilter implements AuthorizationQueryFilter {
    onPerform(context: QueryContext): QueryResult | void {
        const value = (context.query as { value?: unknown }).value;
        if (typeof value === 'string' && /^(deny|allow)/.test(value)) recordFilterParity('query authorization', value);
        if (typeof value === 'string' && value.startsWith('deny')) return unauthorizedQueryResult(context);
    }
}
