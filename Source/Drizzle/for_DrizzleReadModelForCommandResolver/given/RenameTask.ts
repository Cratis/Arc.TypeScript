// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, commandReadModel, inject, key } from '@cratis/arc.core';
import { field, Guid } from '@cratis/fundamentals';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';

@command()
export class RenameTask {
    @field(Guid) @key() id!: Guid;
    @inject(commandReadModel(TaskRecord))
    handle(task: TaskRecord): string { return task.title; }
}
