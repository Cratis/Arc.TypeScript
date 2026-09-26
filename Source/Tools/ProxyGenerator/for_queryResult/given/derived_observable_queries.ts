// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { key, query, readModel, service } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import type { Observable } from 'rxjs';
import { drizzleReadModel } from '../../../../Drizzle/drizzleToken.js';
import type { DrizzleReadModels } from '../../../../Drizzle/DrizzleReadModels.js';
class TaskRecord {
    @field(String) @key() id!: string;
    @field(String) title!: string;
}

@readModel()
export class DerivedObservableQueries {
    @query({ observable: true }, service(drizzleReadModel(TaskRecord)))
    static unannotated(tasks: DrizzleReadModels<TaskRecord>) { return tasks.observe(); }

    @query({ observable: true }, service(drizzleReadModel(TaskRecord)))
    static annotated(tasks: DrizzleReadModels<TaskRecord>): Observable<TaskRecord[]> { return tasks.observe(); }
}
