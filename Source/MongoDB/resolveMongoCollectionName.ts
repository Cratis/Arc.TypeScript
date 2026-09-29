// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MongoDBOptions } from './MongoDBOptions.js';
import { defaultMongoNamingPolicy } from './MongoNamingPolicy.js';

/**
 * Resolve the collection a read model class is stored in: the `collectionName` override when set, otherwise the
 * naming policy's name. Arc reads the collection through this rule, and the Chronicle client Arc creates writes
 * projected read models through the same one.
 */
export function resolveMongoCollectionName(options: Pick<MongoDBOptions, 'namingPolicy' | 'collectionName'>,
    type: new () => object): string {
    const namingPolicy = options.namingPolicy ?? defaultMongoNamingPolicy;
    const collectionName = options.collectionName?.(type) ?? namingPolicy.collectionName(type);
    if (!collectionName) throw new Error('MongoDB collection name is required');
    return collectionName;
}
