// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { Tasks } from '../../../Tasks.js';
import { TaskItem } from '../../TaskItem.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when performing a query with a concept argument', () => {
    let scenario: QueryScenario<{ id: string; title: string }>;
    let title: string | undefined;
    beforeEach(async () => {
        const tasks = new Tasks();
        const id = TaskId.create();
        tasks.register(id, new TaskTitle('Review API'));
        scenario = QueryScenario.for(TaskItem, 'taskById');
        scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        scenario.services.addSingleton(Tasks, tasks);
        title = (await scenario.perform({ id })).data?.title;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should bind the concept through the wire schema', () => { String(title).should.equal('Review API'); });
});
