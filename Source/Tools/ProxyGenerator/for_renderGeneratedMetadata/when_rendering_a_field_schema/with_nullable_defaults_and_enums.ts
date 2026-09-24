// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';
import { given } from '../../given.js';
import { a_field_project } from '../given/a_field_project.js';

describe('when rendering a command field schema', given(a_field_project, context => {
    let rendered: string;
    beforeEach(() => {
        rendered = renderGeneratedMetadata(context.project, context.artifacts, context.output);
    });
    it('should record enum values on the wire field', () => {
        rendered.should.contain('"priority": { optional: false, nullable: false, values: [1,2] }');
    });
    it('should record nullable and defaulted fields', () => {
        rendered.should.contain('"note": { optional: false, nullable: true }');
        rendered.should.contain('"count": { optional: true, nullable: false, defaultValue: 2 }');
    });
}));
