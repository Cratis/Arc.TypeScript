// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_tasks_project } from '../given/a_tasks_project.js';

describe('when rendering token-free Tasks artifacts', given(a_tasks_project, context => {
    let rendered: string;
    beforeEach(() => {
        rendered = renderGeneratedMetadata(context.project, context.artifacts, context.output);
    });
    it('should import class tokens from their declaring modules', () => {
        rendered.should.contain('from "./Tasks/Tasks.js"');
        rendered.should.contain("['handle', [_arc");
    });
    it('should record query argument position and inferred observability', () => {
        rendered.should.contain('name: "id", type: ');
        rendered.should.contain("observable: true, result: { cardinality: 'many'");
    });
}));
