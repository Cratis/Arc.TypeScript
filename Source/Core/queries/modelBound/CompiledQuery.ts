// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { QueryDefinition } from '../QueryDefinition.js';
import type { ObservableQueryDefinition } from '../observable/ObservableQueryDefinition.js';
import type { ServiceIdentifier } from '../../dependencyInjection/ServiceIdentifier.js';
/** Executable query definition and its injected service dependencies. */
export interface CompiledQuery {
    readonly definition: QueryDefinition<z.ZodType, unknown> | ObservableQueryDefinition<z.ZodType, unknown>;
    readonly dependencies: readonly ServiceIdentifier<unknown>[];
    readonly observable: boolean;
}
