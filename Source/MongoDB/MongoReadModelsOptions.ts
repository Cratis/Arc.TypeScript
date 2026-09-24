// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '@cratis/arc.core';
import type { Document, Filter, MongoClient } from 'mongodb';

/** The application chooses a database and trusted query filter for every tenant. */
export interface MongoReadModelsOptions<T extends Document, I> {
    readonly client: MongoClient;
    /** Maximum number of rows in one page (default: 100). */
    readonly maxPageSize?: number;
    readonly databaseForTenant: (tenantId: string, context: ExecutionContext) => string;
    /** Application-owned mapping from parsed query input to a trusted MongoDB filter. */
    readonly filterFor: (input: I, context: ExecutionContext) => Filter<T>;
}
