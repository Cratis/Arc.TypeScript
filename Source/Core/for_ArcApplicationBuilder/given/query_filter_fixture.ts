// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
import { queryFilterResult } from '../../queries/queryFilterResult.js';
import { authorizationQueryFilter } from '../../queries/authorizationQueryFilterDecorator.js';
import { queryPipelineFilter } from '../../queries/queryPipelineFilterDecorator.js';
import { validation } from '../../validation/ValidationResult.js';

/** A per-spec query world with distinct admission, validation, and performer effects. */
export class query_filter_fixture {
    readonly calls: string[] = [];
    readonly authorization: new () => { onPerform(context: QueryContext): QueryResult | void };
    readonly pipeline: new () => { onPerform(context: QueryContext): QueryResult };
    constructor() {
        const calls = this.calls;
        @authorizationQueryFilter()
        class Admission {
            onPerform(context: QueryContext): QueryResult | void {
                calls.push('authorization');
                if ((context.query as { value?: string }).value === 'denied') return unauthorizedQueryResult(context);
            }
        }
        @queryPipelineFilter()
        class Pipeline {
            onPerform(context: QueryContext): QueryResult {
                calls.push('pipeline');
                return queryFilterResult(context);
            }
        }
        this.authorization = Admission;
        this.pipeline = Pipeline;
    }
    get builder(): ReturnType<typeof ArcApplication.createBuilder> { return ArcApplication.createBuilder({ queries: [defineQuery({
        name: 'FilteredQuery', schema: z.object({ value: z.string() }), authorization: { anonymous: true },
        validate: ({ value }) => {
            this.calls.push('validate');
            return value === 'invalid' ? [validation('Invalid value', ['value'])] : [];
        },
        perform: ({ value }) => { this.calls.push('perform'); return { value }; }
    })] }); }
    readonly execution = { correlationId: 'query-filter-request', principal: undefined, tenantId: undefined,
        signal: new AbortController().signal, allowedSeverity: 2 };
}
