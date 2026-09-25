// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { recordFailure } from '../execution/failureTracking.js';
import { mergeFilterFragment } from '../execution/mergeFilterFragment.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { AuthorizationQueryFilter } from './AuthorizationQueryFilter.js';
import type { QueryPipelineFilter } from './QueryPipelineFilter.js';
import type { QueryContext } from './QueryContext.js';
import type { QueryResult } from './QueryResult.js';
import { queryResult } from './createQueryResult.js';

/** Run one query filter group and stop at the first unsuccessful fragment. */
export async function runQueryFilters(context: QueryContext, options: ArcOptions, authorization: boolean): Promise<QueryResult> {
    const tokens: readonly ServiceIdentifier<AuthorizationQueryFilter | QueryPipelineFilter>[] = authorization
        ? options.authorizationQueryFilters ?? [] : options.queryPipelineFilters ?? [];
    let result = queryResult(context);
    const checkCancellation = (): void => {
        if (context.signal.aborted) throw context.signal.reason ?? new Error('Query canceled');
    };
    try {
        checkCancellation();
        for (const token of new Set(tokens)) {
            checkCancellation();
            const filter = await currentServices().resolve(token);
            checkCancellation();
            const fragment = await filter.onPerform(context);
            checkCancellation();
            if (fragment !== undefined) {
                const merged = mergeFilterFragment(result, fragment);
                result = queryResult(context, { ...merged, isReady: result.isReady && fragment.isReady !== false });
            }
            if (!result.isSuccess) break;
        }
        checkCancellation();
    } catch (error) {
        result = queryResult(context, { ...result, exceptionMessages: [...result.exceptionMessages, String(error)] });
        recordFailure(result, error);
    }
    return result;
}
