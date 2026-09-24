// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ObservableQueryDefinition } from './ObservableQueryDefinition.js';

/** Declare a live query with the same schema, filters, authorization and scope semantics as defineQuery. */
export function defineObservableQuery<S extends z.ZodType, T>(definition: ObservableQueryDefinition<S, T>): ObservableQueryDefinition<S, T> {
    return definition;
}
