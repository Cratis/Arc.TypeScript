// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { QueryDefinition } from '../QueryDefinition.js';
import type { ObservableSource } from './ObservableSource.js';

/** A query whose producer provides full snapshots through an async iterable or structural observable. */
export interface ObservableQueryDefinition<S extends z.ZodType, T> extends Omit<QueryDefinition<S, T>, 'perform'> {
    /** Called once per subscription, after authorization and validation, within the subscription service scope. */
    observe: (input: z.output<S>, context: Parameters<QueryDefinition<S, T>['perform']>[1],
        options: Parameters<QueryDefinition<S, T>['perform']>[2]) => ObservableSource<T> | Promise<ObservableSource<T>>;
}
