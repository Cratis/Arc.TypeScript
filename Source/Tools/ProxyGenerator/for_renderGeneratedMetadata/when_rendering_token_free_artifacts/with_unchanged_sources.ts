// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_tasks_project } from '../given/a_tasks_project.js';

describe('when rendering token-free artifacts with unchanged sources', given(a_tasks_project, context => {
    let rendered: string;
    let repeated: string;
    beforeEach(() => {
        rendered = renderGeneratedMetadata(context.project, context.artifacts, context.output);
        repeated = renderGeneratedMetadata(context.project, context.artifacts, context.output);
    });
    it('should generate identical bytes for unchanged sources', () => {
        rendered.should.equal(repeated);
    });
}));
