// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { RegisterTask } from '../../RegisterTask.js';
import { RegisterTaskValidator } from '../../RegisterTaskValidator.js';

export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);

    constructor() { this.scenario.services.addSingleton(Tasks, this.tasks); }
}
