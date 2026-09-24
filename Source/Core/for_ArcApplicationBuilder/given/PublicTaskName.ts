// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ReadModelInterceptor } from '../../queries/ReadModelInterceptor.js';
import { readModelInterceptor } from '../../queries/readModelInterceptorDecorator.js';
import { Task } from '../../queries/for_queryRendering/given/Task.js';

/** Scoped interceptor declared as a typed class token. */
@readModelInterceptor()
export class PublicTaskName implements ReadModelInterceptor<Task> {
    readonly model = Task;
    intercept(task: Task): Task { return new Task(`public-${task.name}`); }
}
