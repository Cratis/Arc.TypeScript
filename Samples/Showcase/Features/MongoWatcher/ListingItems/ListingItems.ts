// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel, service } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import { WatcherItem } from '../WatcherItem.js';

const items = mongoCollection(WatcherItem);

/**
 * Queries over the tenant's items; a change stream drives the live list. `collection.queryPage(filter, options)` would let
 * MongoDB count, sort and page, but the proxy generator rejects a `queryOptions()` parameter (see the sample README).
 */
@readModel()
export class WatcherItemQueries {
    @query(service(items))
    static async all(collection: MongoCollection<WatcherItem>): Promise<WatcherItem[]> { return collection.find(); }

    @query({ observable: true }, service(items))
    static observeItems(collection: MongoCollection<WatcherItem>) { return collection.observe(); }
}
