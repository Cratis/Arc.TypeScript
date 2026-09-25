// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { analyzeSource } from '../../analyzeSource.js';
import { given } from '../../given.js';
import { a_field_project } from '../given/a_field_project.js';

describe('when rendering a command field schema with optional client fields', given(a_field_project, context => {
    let command: ReturnType<typeof analyzeSource>['operations'][number] | undefined;
    beforeEach(() => {
        command = analyzeSource(context.project, context.artifacts, '', true).operations[0];
    });
    it('should accept TypeScript-optional fields in the paired client analysis', () => {
        (command?.fields.find(field => field.name === 'nickname')?.optional === true).should.equal(true);
    });
}));
