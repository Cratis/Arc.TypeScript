// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ExecutionContext } from '../../ExecutionContext.js';
import type { QueryOptions } from '../../QueryOptions.js';
import type { QueryResult } from '../../QueryResult.js';
import type { Operation } from '../../operation.js';
import { queryOperation } from '../../pipelines.js';
import type { ObservableQueryDefinition } from './ObservableQueryDefinition.js';
import type { ObservableSource } from './ObservableSource.js';

/** One registered live query; its first pipeline pass opens the source, later passes render emissions. */
export interface ObservableOperation extends Operation {
    readonly observable: true;
    render(input: unknown, context: ExecutionContext, options: QueryOptions | undefined, data: unknown): Promise<QueryResult>;
}

export function observableOperation<S extends z.ZodType, T>(definition: ObservableQueryDefinition<S, T>, route: string): ObservableOperation {
    const startup = queryOperation({ ...definition, clientOutput: undefined, perform: definition.observe }, route);
    return {
        ...startup, clientOutput: definition.clientOutput, observable: true,
        async run(input, context): Promise<QueryResult> {
            const result = await startup.run(input, context) as QueryResult<ObservableSource<T>>;
            if (result.isSuccess && (!result.data || typeof result.data !== 'object' ||
                !(Symbol.asyncIterator in result.data) && typeof Reflect.get(result.data, 'subscribe') !== 'function'))
                throw new Error('Observable query producer must return an async iterable or subscribable');
            return result;
        },
        async render(input, context, options, data): Promise<QueryResult> {
            const renderer = queryOperation({ ...definition, perform: () => data as T }, route);
            return renderer.run(input, context, options) as Promise<QueryResult>;
        }
    };
}

export function isObservableOperation(operation: Operation): operation is ObservableOperation {
    return 'observable' in operation && operation.observable === true;
}
