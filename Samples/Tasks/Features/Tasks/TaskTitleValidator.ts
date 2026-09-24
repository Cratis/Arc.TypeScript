// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptValidator, validator } from '@cratis/arc.core';
import { TaskTitle } from './TaskTitle.js';

@validator(TaskTitle)
export class TaskTitleValidator extends ConceptValidator<TaskTitle> {
    constructor() {
        super();
        this.ruleFor(title => title.value).must(value => !value.startsWith('!'))
            .withMessage('A title cannot begin with an exclamation mark');
    }
}
