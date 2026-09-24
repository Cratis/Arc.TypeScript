// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { argument, query, readModel, service, type ObservableSource } from '@cratis/arc.core';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }

    @query(argument('id', TaskId), service(Tasks))
    static taskById(id: TaskId, tasks: Tasks): TaskItem | undefined { return tasks.byId(id); }

    @query({ observable: true }, service(Tasks))
    static observeAllTasks(tasks: Tasks): ObservableSource<TaskItem[]> { return tasks.observeAll(); }
}
