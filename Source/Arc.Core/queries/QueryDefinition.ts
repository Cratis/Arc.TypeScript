// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { DescriptorBase } from '../DescriptorBase.js';
import type { QueryFilter } from './QueryFilter.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { QueryOptions } from './QueryOptions.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
export interface QueryDefinition<S extends z.ZodType, T> extends DescriptorBase {
    schema: S;
    handlerDependencies?: readonly ServiceIdentifier<unknown>[];
    validatorDependencies?: readonly ServiceIdentifier<unknown>[];
    authorize?: (input: z.output<S>, context: ExecutionContext) => boolean | Promise<boolean>;
    validate?: QueryFilter<z.output<S>>;
    perform: (input: z.output<S>, context: ExecutionContext, options: QueryOptions) => T | Promise<T>;
    filters?: readonly QueryFilter<z.output<S>>[];
}
