// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_registration } from '../given/a_task_registration.js';

describe('when validating a task with an empty title', given(a_task_registration, context => {
    let result: ScenarioCommandResult;
    beforeEach(async () => {
        result = await context.scenario.validate({ id: TaskId.create(), title: new TaskTitle('') });
    });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should report the authored rule for title', () => {
        result.shouldHaveValidationErrors().shouldHaveValidationErrorForMember('title');
    });
    it('should not invoke the handler', () => { context.tasks.all().should.have.lengthOf(0); });
}));
