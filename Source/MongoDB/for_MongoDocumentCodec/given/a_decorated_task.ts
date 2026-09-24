// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
import { TaskName } from './TaskName.js';
import { TaskDetails } from './TaskDetails.js';

export class TaskItem {
    @field(Guid) @key() id!: Guid;
    @field(TaskName) name!: TaskName;
    @field(DateOnly) due!: DateOnly;
    @field(TimeOnly) time!: TimeOnly;
    @field(TimeSpan) elapsed!: TimeSpan;
    @field(Date) created!: Date;
    @field(Array, { genericArguments: [TaskDetails] }) details!: TaskDetails[];
}
