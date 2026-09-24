// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '@cratis/arc.core';
import type { MongoClient } from 'mongodb';

/** Application-owned client routing and read-model registrations. */
export interface MongoDBOptions {
    /** Supply an existing client, or a MongoDB URI for an Arc-owned client. */
    readonly client?: MongoClient;
    readonly server?: string;
    /** Default database name; non-default tenants use `<database>+<tenantId>`. */
    readonly database?: string;
    readonly databaseNameResolver?: (tenantId: string, context: ExecutionContext) => string;
    readonly serverResolver?: (tenantId: string, context: ExecutionContext) => string;
    /** Model classes registered for scoped injection. */
    readonly readModels: readonly (new () => object)[];
    /** Map model classes to physical collection names. Defaults to the class name. */
    readonly collectionName?: (model: new () => object) => string;
    /** Bypass metadata codecs for collections that already store driver-native documents. */
    readonly ignoreConventions?: boolean;
    /** Maximum documents in an observed full snapshot (default: 1000). */
    readonly maxObservableItems?: number;
    /** Maximum documents per page (default: 100). */
    readonly maxPageSize?: number;
}
