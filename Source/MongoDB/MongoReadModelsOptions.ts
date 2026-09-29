// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType, ExecutionContext } from '@cratis/arc.core';
import type { Document, Filter, MongoClient, WithId } from 'mongodb';

/** The application chooses a database and trusted query filter for every tenant. */
export interface MongoReadModelsOptions<T extends Document, I> {
    readonly client: MongoClient;
    /** Maximum number of rows in one page (default: 100). */
    readonly maxPageSize?: number;
    /** Explicit fields that a caller may request through Arc sorting. */
    readonly sortableFields?: readonly string[];
    readonly databaseForTenant: (tenantId: string, context: ExecutionContext) => string;
    /** Application-owned mapping from parsed query input to a trusted MongoDB filter. */
    readonly filterFor: (input: I, context: ExecutionContext) => Filter<T>;
    /**
     * The read model these raw documents hold. When set, every returned document carries the model, tenant and
     * subject so a registered read-model interceptor (such as Chronicle's compliance release) transforms it before
     * it is served, and field projections are rejected. Chronicle releases the documents only when this class is
     * registered with `withChronicle`; otherwise no interceptor exists for it and they are served as stored.
     */
    readonly readModel?: ClassType;
    /**
     * The compliance subject of a document (default: the `__subject` Chronicle stored, otherwise its string or
     * numeric `_id`). Requires `readModel`.
     */
    readonly subjectFor?: (document: WithId<T>) => string;
}
