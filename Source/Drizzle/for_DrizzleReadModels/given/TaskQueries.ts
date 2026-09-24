// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, queryOptions, readModel, service } from '@cratis/arc.core';
import type { QueryOptions } from '@cratis/arc.core';
import { drizzleReadModel } from '../../drizzleToken.js';
import type { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { TaskRecord } from './TaskRecord.js';

/** Model-bound SQL query through the regular Arc pipeline. */
@readModel()
export class TaskQueries {
    @query(service(drizzleReadModel(TaskRecord)), queryOptions())
    static page(tasks: DrizzleReadModels<TaskRecord>, options: QueryOptions) {
        return tasks.queryPage(undefined, options);
    }
}
