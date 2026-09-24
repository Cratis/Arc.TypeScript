// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { checkGeneratedMetadata } from '../../publishGeneratedMetadata.js';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_tasks_project } from '../given/a_tasks_project.js';

describe('when checking generated metadata against changed source', given(a_tasks_project, context => {
    let error: unknown;
    beforeEach(async () => {
        const source = renderGeneratedMetadata(context.project, context.artifacts, context.output);
        try { await checkGeneratedMetadata(context.output, source.replace('name: "id"', 'name: "renamed"')); }
        catch (failure) { error = failure; }
    });
    it('should reject stale output with a regeneration message', () => {
        (error as Error).message.should.contain('regenerate artifact metadata');
    });
}));
