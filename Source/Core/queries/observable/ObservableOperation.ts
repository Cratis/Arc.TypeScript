// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import type { QueryOptions } from '../QueryOptions.js';
import type { QueryResult } from '../QueryResult.js';
import type { Operation } from '../../http/Operation.js';
import { queryOperation } from '../queryOperation.js';
import { renderQuery } from '../renderQuery.js';
import type { ArcServerOptions } from '../../ArcServerOptions.js';
import { queryResult } from '../../results/index.js';
import { recordFailure } from '../../results/failureTracking.js';
import type { ObservableQueryDefinition } from './ObservableQueryDefinition.js';
import type { ObservableSource } from './ObservableSource.js';

/** One registered live query; its first pipeline pass opens the source, later passes render emissions. */
export interface ObservableOperation extends Operation {
    readonly observable: true;
    render(input: unknown, context: ExecutionContext, options: QueryOptions | undefined, data: unknown): Promise<QueryResult>;
}

export function observableOperation<S extends z.ZodType, T>(
    definition: ObservableQueryDefinition<S, T>, route: string, settings: ArcServerOptions = {}
): ObservableOperation {
    const startup = queryOperation({ ...definition, clientOutput: undefined, perform: definition.observe }, route, true, settings);
    return {
        ...startup, clientOutput: definition.clientOutput, observable: true,
        async run(input, context, options): Promise<QueryResult> {
            const result = await startup.run(input, context, options) as QueryResult<ObservableSource<T>>;
            if (result.isSuccess && (!result.data || typeof result.data !== 'object' ||
                !(Symbol.asyncIterator in result.data) && typeof Reflect.get(result.data, 'subscribe') !== 'function'))
                throw new Error('Observable query producer must return an async iterable or subscribable');
            return result;
        },
        async render(_input, context, options, data): Promise<QueryResult> {
            try { return await renderQuery(definition, data, context, options, settings); }
            catch (error) {
                const result = queryResult(context, { exceptionMessages: [String(error)] });
                recordFailure(result, error);
                return result;
            }
        }
    };
}

export function isObservableOperation(operation: Operation): operation is ObservableOperation {
    return 'observable' in operation && operation.observable === true;
}
