// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_registration } from '../given/a_task_registration.js';

describe('when registering a task with a valid title', given(a_task_registration, context => {
    const id = TaskId.create();
    let result: ScenarioCommandResult;

    beforeAll(async () => {
        result = await context.scenario.execute({ id, title: new TaskTitle('Plan release') });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed through the command pipeline', () => { result.shouldBeSuccessful(); });
    it('should register the task with the service', () => {
        String(context.tasks.byId(id)?.title.value).should.equal('Plan release');
    });
}));
