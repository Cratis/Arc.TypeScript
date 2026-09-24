// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, queryOptions, readModel, service } from '@cratis/arc.core';
import type { QueryOptions } from '@cratis/arc.core';
import { mongoCollection } from '../../collectionToken.js';
import type { MongoCollection } from '../../MongoCollection.js';
import { TaskRecord } from './TaskRecord.js';
const collection = mongoCollection(TaskRecord);
@readModel()
export class TaskQueries {
    @query(service(collection))
    static async all(tasks: MongoCollection<TaskRecord>): Promise<TaskRecord[]> { return tasks.find(); }
    @query(service(collection), queryOptions())
    static async page(tasks: MongoCollection<TaskRecord>, options: QueryOptions) {
        return tasks.queryPage({}, options);
    }
    @query({ observable: true }, service(collection))
    static async changes(tasks: MongoCollection<TaskRecord>) { return tasks.observe(); }
}
