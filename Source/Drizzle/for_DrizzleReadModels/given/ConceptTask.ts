// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { TaskId } from './TaskId.js';

/** Read model keyed by a GUID concept. */
export class ConceptTask {
    @field(TaskId) id!: TaskId;
    @field(String) title!: string;
}
