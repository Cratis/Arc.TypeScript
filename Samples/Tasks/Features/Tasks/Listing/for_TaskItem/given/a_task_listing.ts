// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario, QueryScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { TaskItem } from '../../TaskItem.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_task_listing {
    tasks = new Tasks();
    query = QueryScenario.for<{ id: string; title: string }[]>(TaskItem, 'allTasks');
    observable = ObservableQueryScenario.for<{ id: string; title: string }[]>(TaskItem, 'observeAllTasks');

    constructor() {
        this.query.extend(builder => builder.useGeneratedMetadata(metadata));
        this.observable.extend(builder => builder.useGeneratedMetadata(metadata));
        this.query.services.addSingleton(Tasks, this.tasks);
        this.observable.services.addSingleton(Tasks, this.tasks);
    }
}
