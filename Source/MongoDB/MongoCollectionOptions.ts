// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { MongoNamingPolicy } from './MongoNamingPolicy.js';

/** Options for a tenant-bound MongoDB collection. */
export type MongoCollectionOptions = {
    ignoreConventions?: boolean;
    maxObservableItems?: number;
    maxPageSize?: number;
    namingPolicy?: MongoNamingPolicy;
};
